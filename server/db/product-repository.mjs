export class ProductRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async listActive() {
    const { rows } = await this.queryable.query(
      `SELECT sku, name, description, price_minor, currency,
              fulfillment_mode, image_url, metadata
       FROM products
       WHERE active = true
       ORDER BY created_at, sku`,
    );
    return rows;
  }
}
