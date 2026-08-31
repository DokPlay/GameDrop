import { randomUUID } from "node:crypto";
import { closePool, getPool } from "../server/db/pool.mjs";
import { migrate } from "../server/db/migrate.mjs";
import { withTransaction } from "../server/db/transaction.mjs";

const products = [
  {
    sku: "KEY-CS2-PRIME",
    name: "Counter-Strike 2 — Prime Status",
    description: "Цифровой ключ активации Prime Status для Steam.",
    price: 129000,
    mode: "pool",
  },
  {
    sku: "STEAM-TOPUP-500",
    name: "Пополнение Steam — 500 ₽",
    description: "Тестовый товар с выдачей через поставщиков A/B.",
    price: 55000,
    mode: "supplier",
  },
];

const pool = getPool();

try {
  await migrate({ pool });
  await withTransaction(async (client) => {
    for (const product of products) {
      await client.query(
        `INSERT INTO products (
           id, sku, name, description, price_minor, currency, fulfillment_mode, active
         ) VALUES ($1, $2, $3, $4, $5, 'RUB', $6, true)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_minor = EXCLUDED.price_minor,
           fulfillment_mode = EXCLUDED.fulfillment_mode,
           active = true,
           updated_at = now()`,
        [randomUUID(), product.sku, product.name, product.description, product.price, product.mode],
      );
    }

    await client.query(
      `INSERT INTO promos (
         id, code, discount_type, discount_value, max_uses, used_count, active
       ) VALUES ($1, 'WELCOME10', 'percent', 10, 100, 0, true)
       ON CONFLICT (code) DO UPDATE SET active = true`,
      [randomUUID()],
    );

    const { rows } = await client.query(
      "SELECT id FROM products WHERE sku = 'KEY-CS2-PRIME'",
    );
    for (let index = 1; index <= 12; index += 1) {
      const code = `CS2-PRIME-DEMO-${String(index).padStart(4, "0")}`;
      await client.query(
        `INSERT INTO inventory_keys (id, product_id, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [randomUUID(), rows[0].id, code],
      );
    }
  }, { pool });
  process.stdout.write("GameDrop seed data is ready.\n");
} finally {
  await closePool();
}
