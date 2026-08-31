import { afterAll, beforeEach, expect, test } from "vitest";
import { FulfillmentRepository } from "../../server/db/fulfillment-repository.mjs";
import { FulfillmentService } from "../../server/domain/fulfillment-service.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const service = new FulfillmentService({ pool });
const repository = new FulfillmentRepository(pool);

beforeEach(async () => {
  await fixtures.reset();
});

afterAll(async () => {
  await pool.end();
});

test("fifty concurrent attempts consume one key and create one fulfillment fact", async () => {
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME" });
  const order = await fixtures.createOrder(product.id);
  await fixtures.markOrderPaid(order.id);
  await fixtures.createKey(product.id, "CS2-ONLY-KEY");

  const results = await Promise.all(
    Array.from({ length: 50 }, () => service.fulfillPaidOrder(order.id)),
  );

  expect(results.every((result) => result.status === "delivered")).toBe(true);
  expect(await repository.countFulfillments(order.id)).toBe(1);
  expect(await repository.countAssignedKeys(order.id)).toBe(1);
  expect((await repository.getOrder(order.id)).status).toBe("delivered");
});

test("an empty pool preserves payment in a recoverable out-of-stock state", async () => {
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME" });
  const order = await fixtures.createOrder(product.id);
  await fixtures.markOrderPaid(order.id);

  const result = await service.fulfillPaidOrder(order.id);

  expect(result).toMatchObject({ status: "out_of_stock", issuedCode: null });
  expect(await repository.countFulfillments(order.id)).toBe(1);
  expect(await repository.countAssignedKeys(order.id)).toBe(0);
});
