export class OrderRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async findById(id, options = {}) {
    const lockClause = options.forUpdate ? " FOR UPDATE" : "";
    const { rows } = await this.queryable.query(
      `SELECT * FROM orders WHERE id = $1${lockClause}`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByClientRequestId(clientRequestId) {
    const { rows } = await this.queryable.query(
      "SELECT * FROM orders WHERE client_request_id = $1",
      [clientRequestId],
    );
    return rows[0] ?? null;
  }

  async findProductBySku(sku) {
    const { rows } = await this.queryable.query(
      "SELECT * FROM products WHERE sku = $1 AND active = true",
      [sku],
    );
    return rows[0] ?? null;
  }

  async insert(order) {
    const { rows } = await this.queryable.query(
      `INSERT INTO orders (
         id, client_request_id, product_id, promo_id, sku, product_name,
         status, subtotal_minor, discount_minor, total_minor, currency
       ) VALUES ($1, $2, $3, $4, $5, $6, 'created', $7, $8, $9, $10)
       RETURNING *`,
      [
        order.id,
        order.clientRequestId,
        order.productId,
        order.promoId,
        order.sku,
        order.productName,
        order.subtotal,
        order.discount,
        order.total,
        order.currency,
      ],
    );
    return rows[0];
  }

  async addPromoRedemption(redemption) {
    await this.queryable.query(
      `INSERT INTO promo_redemptions (id, promo_id, order_id, discount_minor)
       VALUES ($1, $2, $3, $4)`,
      [redemption.id, redemption.promoId, redemption.orderId, redemption.discount],
    );
  }

  async countRedemptions(code) {
    const { rows } = await this.queryable.query(
      `SELECT count(*)::integer AS count
       FROM promo_redemptions AS redemption
       JOIN promos AS promo ON promo.id = redemption.promo_id
       WHERE promo.code = $1`,
      [code.trim().toUpperCase()],
    );
    return rows[0].count;
  }
}
