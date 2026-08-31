import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

export function createTestPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
}

export function databaseFixtures(pool) {
  return {
    async reset() {
      await pool.query(`
        TRUNCATE TABLE
          fulfillment_attempts,
          supplier_requests,
          pending_payment_events,
          payment_events,
          fulfillment_records,
          inventory_keys,
          promo_redemptions,
          orders,
          promos,
          products
        RESTART IDENTITY
      `);
    },

    async createProduct(overrides = {}) {
      const product = {
        sku: overrides.sku ?? `SKU-${randomUUID()}`,
        name: overrides.name ?? "Counter-Strike 2 Prime",
        price: overrides.price ?? 129000,
      };
      const { rows } = await pool.query(
        `INSERT INTO products (id, sku, name, price_minor, currency, active)
         VALUES ($1, $2, $3, $4, 'RUB', true)
         RETURNING *`,
        [randomUUID(), product.sku, product.name, product.price],
      );
      return rows[0];
    },

    async createOrder(productId, overrides = {}) {
      const { rows } = await pool.query(
        `INSERT INTO orders (
           id, client_request_id, product_id, sku, product_name, status,
           subtotal_minor, discount_minor, total_minor, currency
         )
         SELECT $1, $2, id, sku, name, 'created', $4, 0, $4, 'RUB'
         FROM products
         WHERE id = $3
         RETURNING *`,
        [randomUUID(), randomUUID(), productId, overrides.total ?? 129000],
      );
      return rows[0];
    },

    async createKey(productId, code = `KEY-${randomUUID()}`) {
      const { rows } = await pool.query(
        `INSERT INTO inventory_keys (id, product_id, code)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [randomUUID(), productId, code],
      );
      return rows[0];
    },

    async createPromo(overrides = {}) {
      const promo = {
        code: overrides.code ?? `PROMO${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
        discountType: overrides.discountType ?? "percent",
        discountValue: overrides.discountValue ?? 10,
        maxUses: overrides.maxUses ?? 10,
      };
      const { rows } = await pool.query(
        `INSERT INTO promos (
           id, code, discount_type, discount_value, max_uses, used_count, active
         ) VALUES ($1, $2, $3, $4, $5, 0, true)
         RETURNING *`,
        [randomUUID(), promo.code, promo.discountType, promo.discountValue, promo.maxUses],
      );
      return rows[0];
    },
  };
}
