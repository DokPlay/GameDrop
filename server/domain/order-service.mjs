import { randomUUID } from "node:crypto";
import { OrderRepository } from "../db/order-repository.mjs";
import { withTransaction } from "../db/transaction.mjs";
import { DomainError } from "./errors.mjs";
import { calculateDiscount, reservePromo } from "./promo-service.mjs";

function toPublicOrder(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    sku: row.sku,
    productName: row.product_name,
    subtotal: row.subtotal_minor,
    discount: row.discount_minor,
    total: row.total_minor,
    currency: row.currency,
    status: row.status,
    issuedCode: row.status === "delivered" ? row.issued_code : null,
    lastError: row.last_error_code
      ? { code: row.last_error_code, detail: row.last_error_detail }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class OrderService {
  constructor({ pool }) {
    this.pool = pool;
  }

  async createOrder(input) {
    if (!input?.clientRequestId || !input?.sku) {
      throw new DomainError(
        "INVALID_ORDER",
        "clientRequestId and sku are required",
        { httpStatus: 400 },
      );
    }

    return withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
        [input.clientRequestId],
      );

      const repository = new OrderRepository(client);
      const existing = await repository.findByClientRequestId(input.clientRequestId);
      if (existing) {
        return toPublicOrder(existing);
      }

      const product = await repository.findProductBySku(input.sku);
      if (!product) {
        throw new DomainError("PRODUCT_NOT_FOUND", "Product is not available", { httpStatus: 404 });
      }

      const promo = input.promoCode ? await reservePromo(client, input.promoCode) : null;
      const subtotal = product.price_minor;
      const discount = calculateDiscount(subtotal, promo);
      const order = await repository.insert({
        id: randomUUID(),
        clientRequestId: input.clientRequestId,
        productId: product.id,
        promoId: promo?.id ?? null,
        sku: product.sku,
        productName: product.name,
        subtotal,
        discount,
        total: subtotal - discount,
        currency: product.currency,
      });

      if (promo) {
        await repository.addPromoRedemption({
          id: randomUUID(),
          promoId: promo.id,
          orderId: order.id,
          discount,
        });
      }

      return toPublicOrder(order);
    }, { pool: this.pool });
  }

  async getOrder(orderId) {
    const repository = new OrderRepository(this.pool);
    const order = await repository.findById(orderId);
    if (!order) {
      throw new DomainError("ORDER_NOT_FOUND", "Order does not exist", { httpStatus: 404 });
    }
    return toPublicOrder(order);
  }
}
