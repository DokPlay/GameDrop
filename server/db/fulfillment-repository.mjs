export class FulfillmentRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async getOrder(orderId, options = {}) {
    const lockClause = options.forUpdate ? " FOR UPDATE" : "";
    const { rows } = await this.queryable.query(
      `SELECT orders.*, products.fulfillment_mode
       FROM orders
       JOIN products ON products.id = orders.product_id
       WHERE orders.id = $1${lockClause}`,
      [orderId],
    );
    return rows[0] ?? null;
  }

  async updateOrderStatus(orderId, status, error = null) {
    const { rows } = await this.queryable.query(
      `UPDATE orders
       SET status = $2,
           last_error_code = $3,
           last_error_detail = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [orderId, status, error?.code ?? null, error?.detail ?? null],
    );
    return rows[0];
  }

  async ensureRecord(record) {
    const { rows } = await this.queryable.query(
      `INSERT INTO fulfillment_records (id, order_id, source, status)
       VALUES ($1, $2, $3, 'delivering')
       ON CONFLICT (order_id) DO UPDATE
         SET status = CASE
           WHEN fulfillment_records.status IN ('out_of_stock', 'failed', 'timeout') THEN 'delivering'
           ELSE fulfillment_records.status
         END,
         updated_at = now()
       RETURNING *`,
      [record.id, record.orderId, record.source],
    );
    return rows[0];
  }

  async claimAvailableKey(productId) {
    const { rows } = await this.queryable.query(
      `SELECT id, code
       FROM inventory_keys
       WHERE product_id = $1 AND assigned_order_id IS NULL
       ORDER BY created_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [productId],
    );
    return rows[0] ?? null;
  }

  async assignKey(keyId, orderId) {
    const { rows } = await this.queryable.query(
      `UPDATE inventory_keys
       SET assigned_order_id = $2, assigned_at = now()
       WHERE id = $1 AND assigned_order_id IS NULL
       RETURNING *`,
      [keyId, orderId],
    );
    return rows[0] ?? null;
  }

  async markDelivered({ fulfillmentId, orderId, keyId, code }) {
    await this.queryable.query(
      `UPDATE fulfillment_records
       SET inventory_key_id = $2,
           status = 'delivered',
           issued_code = $3,
           delivered_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [fulfillmentId, keyId, code],
    );
    const { rows } = await this.queryable.query(
      `UPDATE orders
       SET status = 'delivered',
           issued_code = $2,
           delivered_at = now(),
           last_error_code = NULL,
           last_error_detail = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [orderId, code],
    );
    return rows[0];
  }

  async setSupplierRoute(fulfillmentId, provider, requestId) {
    const { rows } = await this.queryable.query(
      `UPDATE fulfillment_records
       SET source = 'supplier',
           provider = $2,
           request_id = $3,
           status = 'delivering',
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [fulfillmentId, provider, requestId],
    );
    return rows[0];
  }

  async markSupplierDelivered({ fulfillmentId, orderId, provider, requestId, code }) {
    await this.queryable.query(
      `UPDATE fulfillment_records
       SET source = 'supplier', provider = $2, request_id = $3,
           status = 'delivered', issued_code = $4,
           delivered_at = now(), updated_at = now()
       WHERE id = $1`,
      [fulfillmentId, provider, requestId, code],
    );
    const { rows } = await this.queryable.query(
      `UPDATE orders
       SET status = 'delivered', issued_code = $2,
           delivered_at = now(), last_error_code = NULL,
           last_error_detail = NULL, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [orderId, code],
    );
    return rows[0];
  }

  async markSupplierFailure({ fulfillmentId, orderId, provider, requestId, error }) {
    const fulfillmentStatus = error.code === "SUPPLIER_TIMEOUT" ? "timeout" : "failed";
    await this.queryable.query(
      `UPDATE fulfillment_records
       SET source = 'supplier', provider = $2, request_id = $3,
           status = $4, updated_at = now()
       WHERE id = $1`,
      [fulfillmentId, provider, requestId, fulfillmentStatus],
    );
    return this.updateOrderStatus(orderId, "delivery_failed", {
      code: error.code,
      detail: error.message,
    });
  }

  async markOutOfStock({ fulfillmentId, orderId }) {
    await this.queryable.query(
      `UPDATE fulfillment_records
       SET status = 'out_of_stock', updated_at = now()
       WHERE id = $1`,
      [fulfillmentId],
    );
    return this.updateOrderStatus(orderId, "out_of_stock", {
      code: "OUT_OF_STOCK",
      detail: "Payment is preserved; fulfillment can be retried after inventory refill.",
    });
  }

  async addAttempt(attempt) {
    await this.queryable.query(
      `INSERT INTO fulfillment_attempts (
         order_id, fulfillment_id, provider, request_id,
         outcome, error_code, error_detail,
         ambiguous, started_at, finished_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
      [
        attempt.orderId,
        attempt.fulfillmentId,
        attempt.provider ?? null,
        attempt.requestId ?? null,
        attempt.outcome,
        attempt.errorCode ?? null,
        attempt.errorDetail ?? null,
        attempt.ambiguous ?? false,
      ],
    );
  }

  async countFulfillments(orderId) {
    const { rows } = await this.queryable.query(
      "SELECT count(*)::integer AS count FROM fulfillment_records WHERE order_id = $1",
      [orderId],
    );
    return rows[0].count;
  }

  async countAssignedKeys(orderId) {
    const { rows } = await this.queryable.query(
      "SELECT count(*)::integer AS count FROM inventory_keys WHERE assigned_order_id = $1",
      [orderId],
    );
    return rows[0].count;
  }
}
