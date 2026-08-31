import { AdminRepository } from "../db/admin-repository.mjs";
import { withTransaction } from "../db/transaction.mjs";
import { DomainError } from "./errors.mjs";
import { toPublicOrder } from "./order-service.mjs";

export class RecoveryService {
  constructor({ pool, fulfillmentService }) {
    this.pool = pool;
    this.fulfillmentService = fulfillmentService;
  }

  async refillInventory(input) {
    const codes = Array.from(new Set(
      (input?.codes ?? []).map((code) => String(code).trim()).filter(Boolean),
    ));
    if (!input?.sku || codes.length === 0) {
      throw new DomainError("INVALID_REFILL", "sku and at least one non-empty code are required");
    }

    return withTransaction(async (client) => {
      const repository = new AdminRepository(client);
      const product = await repository.findProductBySku(input.sku);
      if (!product) {
        throw new DomainError("PRODUCT_NOT_FOUND", "Product is not available", { httpStatus: 404 });
      }
      return repository.refill(product.id, codes);
    }, { pool: this.pool });
  }

  async retryOrder(orderId) {
    return this.fulfillmentService.fulfillPaidOrder(orderId);
  }

  async listRecoverableOrders() {
    const repository = new AdminRepository(this.pool);
    const rows = await repository.listRecoverable();
    return rows.map((row) => ({ ...toPublicOrder(row), attempts: row.attempts }));
  }
}
