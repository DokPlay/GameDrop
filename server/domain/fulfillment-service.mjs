import { randomUUID } from "node:crypto";
import { FulfillmentRepository } from "../db/fulfillment-repository.mjs";
import { withTransaction } from "../db/transaction.mjs";
import { DomainError } from "./errors.mjs";
import { toPublicOrder } from "./order-service.mjs";
import { transition } from "./status-machine.mjs";

export class FulfillmentService {
  constructor({ pool, supplierService = null }) {
    this.pool = pool;
    this.supplierService = supplierService;
  }

  async fulfillPaidOrder(orderId, options = {}) {
    return withTransaction(async (client) => {
      const repository = new FulfillmentRepository(client);
      let order = await repository.getOrder(orderId, { forUpdate: true });

      if (!order) {
        throw new DomainError("ORDER_NOT_FOUND", "Order does not exist", { httpStatus: 404 });
      }
      if (order.status === "delivered") {
        return toPublicOrder(order);
      }
      if (!new Set(["paid", "out_of_stock", "delivery_failed"]).has(order.status)) {
        throw new DomainError(
          "ORDER_NOT_PAID",
          "Only a paid or recoverable order can be fulfilled",
          { httpStatus: 409 },
        );
      }

      const fulfillmentMode = order.fulfillment_mode;
      const delivering = transition(order.status, "delivering");
      order = await repository.updateOrderStatus(order.id, delivering);
      const fulfillment = await repository.ensureRecord({
        id: randomUUID(),
        orderId: order.id,
        source: fulfillmentMode,
      });

      if (fulfillmentMode === "supplier") {
        return this.#fulfillFromSupplier({
          repository,
          order,
          fulfillment,
          behaviors: options.supplierBehaviors ?? {},
        });
      }

      const key = await repository.claimAvailableKey(order.product_id);

      if (!key) {
        order = await repository.markOutOfStock({
          fulfillmentId: fulfillment.id,
          orderId: order.id,
        });
        await repository.addAttempt({
          orderId: order.id,
          fulfillmentId: fulfillment.id,
          outcome: "out_of_stock",
          errorCode: "OUT_OF_STOCK",
          errorDetail: "No unassigned inventory key is currently available.",
        });
        return toPublicOrder(order);
      }

      const assigned = await repository.assignKey(key.id, order.id);
      if (!assigned) {
        throw new DomainError(
          "KEY_CLAIM_CONFLICT",
          "The selected key was claimed concurrently",
          { httpStatus: 409 },
        );
      }

      order = await repository.markDelivered({
        fulfillmentId: fulfillment.id,
        orderId: order.id,
        keyId: key.id,
        code: key.code,
      });
      await repository.addAttempt({
        orderId: order.id,
        fulfillmentId: fulfillment.id,
        outcome: "delivered",
      });
      return toPublicOrder(order);
    }, { pool: this.pool });
  }

  async #fulfillFromSupplier({ repository, order, fulfillment, behaviors }) {
    if (!this.supplierService) {
      throw new DomainError("SUPPLIER_NOT_CONFIGURED", "Supplier service is not configured", {
        httpStatus: 503,
      });
    }

    const requestId = fulfillment.request_id ?? `fulfill_${order.id}`;
    const firstProvider = fulfillment.provider ?? "A";
    const providers = firstProvider === "A" ? ["A", "B"] : [firstProvider];

    for (const provider of providers) {
      await repository.setSupplierRoute(fulfillment.id, provider, requestId);
      try {
        const response = await this.supplierService.issueFromSupplier({
          provider,
          requestId,
          sku: order.sku,
          orderId: order.id,
          behavior: behaviors[provider],
        });
        const delivered = await repository.markSupplierDelivered({
          fulfillmentId: fulfillment.id,
          orderId: order.id,
          provider,
          requestId,
          code: response.code,
        });
        await repository.addAttempt({
          orderId: order.id,
          fulfillmentId: fulfillment.id,
          provider,
          requestId,
          outcome: "delivered",
        });
        return toPublicOrder(delivered);
      } catch (error) {
        const isTimeout = error.code === "SUPPLIER_TIMEOUT";
        await repository.addAttempt({
          orderId: order.id,
          fulfillmentId: fulfillment.id,
          provider,
          requestId,
          outcome: isTimeout ? "timeout" : "failed",
          errorCode: error.code ?? "SUPPLIER_ERROR",
          errorDetail: error.message,
          ambiguous: isTimeout,
        });

        if (isTimeout || provider === "B" || error.code !== "SUPPLIER_5XX") {
          const failed = await repository.markSupplierFailure({
            fulfillmentId: fulfillment.id,
            orderId: order.id,
            provider,
            requestId,
            error,
          });
          return toPublicOrder(failed);
        }
      }
    }

    throw new DomainError("SUPPLIER_EXHAUSTED", "No supplier completed fulfillment", {
      httpStatus: 503,
    });
  }
}
