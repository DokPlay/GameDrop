import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);

beforeEach(async () => {
  await fixtures.reset();
});

afterAll(async () => {
  await pool.end();
});

test("database rejects assigning one inventory key to two orders", async () => {
  const product = await fixtures.createProduct();
  const first = await fixtures.createOrder(product.id);
  const second = await fixtures.createOrder(product.id);
  const key = await fixtures.createKey(product.id, "KEY-CS2-PRIME");

  await pool.query(
    `INSERT INTO fulfillment_records (
       id, order_id, inventory_key_id, source, status, issued_code
     ) VALUES ($1, $2, $3, 'pool', 'delivered', $4)`,
    [randomUUID(), first.id, key.id, key.code],
  );

  await expect(
    pool.query(
      `INSERT INTO fulfillment_records (
         id, order_id, inventory_key_id, source, status, issued_code
       ) VALUES ($1, $2, $3, 'pool', 'delivered', $4)`,
      [randomUUID(), second.id, key.id, key.code],
    ),
  ).rejects.toMatchObject({ code: "23505" });
});
