import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import handler from "../../netlify/functions/api.mjs";
import { closePool } from "../../server/db/pool.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);

async function call(path, body) {
  const response = await handler(new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  await fixtures.reset();
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME", price: 129000 });
  await fixtures.createKey(product.id, "NETLIFY-ADAPTER-KEY");
});

afterAll(async () => {
  await pool.end();
  await closePool();
});

test("Netlify Request adapter completes a real PostgreSQL purchase", async () => {
  const orderId = randomUUID();
  const created = await call("/api/orders", {
    client_request_id: orderId,
    sku: "KEY-CS2-PRIME",
  });
  expect(created).toMatchObject({ status: 201, body: { id: orderId, status: "created" } });

  const paid = await call(`/api/orders/${orderId}/pay`, {});
  expect(paid).toMatchObject({
    status: 200,
    body: { status: "delivered", issued_code: "NETLIFY-ADAPTER-KEY" },
  });
});
