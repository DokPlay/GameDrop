import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createApplication } from "../../server/app.mjs";
import { migrate } from "../../server/db/migrate.mjs";
import { createRouter } from "../../server/router.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const migration = "003_seed_full_catalog.sql";

afterAll(async () => {
  await fixtures.reset();
  await pool.end();
});

test("production seed makes every visible storefront SKU fulfillable", async () => {
  await fixtures.reset();
  await pool.query("DELETE FROM schema_migrations WHERE version = $1", [migration]);
  await migrate({ pool });

  const { rows: products } = await pool.query(
    `SELECT products.sku, products.fulfillment_mode, count(inventory_keys.id)::int AS available_keys
     FROM products
     LEFT JOIN inventory_keys
       ON inventory_keys.product_id = products.id
      AND inventory_keys.assigned_order_id IS NULL
     WHERE products.sku = ANY($1::text[])
     GROUP BY products.id
     ORDER BY products.sku`,
    [[
      "KEY-CS2-PRIME",
      "ROGUE-COMPANY",
      "STEAM-TOPUP-500",
      "WILDCAT-GUN",
      "ZOMBIE-ARMY-4",
    ]],
  );

  expect(products).toHaveLength(5);
  expect(products.filter((product) => product.fulfillment_mode === "pool"))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ sku: "KEY-CS2-PRIME", available_keys: 12 }),
      expect.objectContaining({ sku: "ROGUE-COMPANY", available_keys: 12 }),
      expect.objectContaining({ sku: "WILDCAT-GUN", available_keys: 12 }),
      expect.objectContaining({ sku: "ZOMBIE-ARMY-4", available_keys: 12 }),
    ]));
  expect(products).toContainEqual(expect.objectContaining({
    sku: "STEAM-TOPUP-500",
    fulfillment_mode: "supplier",
  }));

  const router = createRouter(createApplication({ pool, adminToken: "catalog-test-admin" }));
  const issuedCodes = [];
  for (const product of products) {
    const created = await router.handle({
      method: "POST",
      path: "/api/orders",
      headers: { "content-type": "application/json" },
      body: { client_request_id: randomUUID(), sku: product.sku },
    });
    expect(created.status).toBe(201);

    const paid = await router.handle({
      method: "POST",
      path: `/api/orders/${created.body.id}/pay`,
      headers: {},
      body: {},
    });
    expect(paid).toMatchObject({ status: 200, body: { status: "delivered" } });
    issuedCodes.push(paid.body.issued_code);
  }
  expect(new Set(issuedCodes).size).toBe(5);
});
