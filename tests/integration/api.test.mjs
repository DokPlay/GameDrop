import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import { createApplication } from "../../server/app.mjs";
import { createRouter } from "../../server/router.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const application = createApplication({ pool, adminToken: "integration-admin" });
const router = createRouter(application);

beforeEach(async () => {
  await fixtures.reset();
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME", price: 129000 });
  await fixtures.createKey(product.id, "API-DELIVERY-KEY");
});

afterAll(async () => {
  await pool.end();
});

test("REST purchase flow creates, pays, and returns a delivered key", async () => {
  const clientRequestId = randomUUID();
  const created = await router.handle({
    method: "POST",
    path: "/api/orders",
    headers: { "content-type": "application/json" },
    body: { client_request_id: clientRequestId, sku: "KEY-CS2-PRIME", price: 1 },
  });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({
    id: clientRequestId,
    subtotal: 129000,
    total: 129000,
    currency: "RUB",
    status: "created",
  });

  const paid = await router.handle({
    method: "POST",
    path: `/api/orders/${created.body.id}/pay`,
    headers: {},
    body: {},
  });
  expect(paid.status).toBe(200);
  expect(paid.body).toMatchObject({ status: "delivered", issued_code: "API-DELIVERY-KEY" });
});

test("admin recovery listing requires and accepts the configured token", async () => {
  const denied = await router.handle({
    method: "GET",
    path: "/api/admin/orders",
    headers: {},
    query: new URLSearchParams(),
  });
  expect(denied.status).toBe(401);

  const allowed = await router.handle({
    method: "GET",
    path: "/api/admin/orders",
    headers: { authorization: "Bearer integration-admin" },
    query: new URLSearchParams(),
  });
  expect(allowed).toMatchObject({ status: 200, body: { orders: [] } });
});
