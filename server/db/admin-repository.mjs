import { randomUUID } from "node:crypto";

export class AdminRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async findProductBySku(sku) {
    const { rows } = await this.queryable.query(
      "SELECT * FROM products WHERE sku = $1 AND active = true",
      [sku],
    );
    return rows[0] ?? null;
  }

  async refill(productId, codes) {
    let inserted = 0;
    for (const code of codes) {
      const result = await this.queryable.query(
        `INSERT INTO inventory_keys (id, product_id, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [randomUUID(), productId, code],
      );
      inserted += result.rowCount;
    }
    return { inserted, ignored: codes.length - inserted };
  }

  async listRecoverable() {
    const { rows } = await this.queryable.query(
      `SELECT orders.*,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'provider', attempts.provider,
               'requestId', attempts.request_id,
               'outcome', attempts.outcome,
               'errorCode', attempts.error_code,
               'ambiguous', attempts.ambiguous,
               'startedAt', attempts.started_at
             ) ORDER BY attempts.started_at
           ) FILTER (WHERE attempts.id IS NOT NULL),
           '[]'::jsonb
         ) AS attempts
       FROM orders
       LEFT JOIN fulfillment_attempts AS attempts ON attempts.order_id = orders.id
       WHERE orders.status IN ('out_of_stock', 'delivery_failed')
       GROUP BY orders.id
       ORDER BY orders.created_at`,
    );
    return rows;
  }
}
