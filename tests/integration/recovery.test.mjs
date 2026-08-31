import { afterAll, beforeEach, expect, test } from "vitest";
import { FulfillmentRepository } from "../../server/db/fulfillment-repository.mjs";
import { FulfillmentService } from "../../server/domain/fulfillment-service.mjs";
import { RecoveryService } from "../../server/domain/recovery-service.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const fulfillment = new FulfillmentService({ pool });
const recovery = new RecoveryService({ pool, fulfillmentService: fulfillment });
const repository = new FulfillmentRepository(pool);

beforeEach(async () => {
  await fixtures.reset();
});

afterAll(async () => {
  await pool.end();
});

test("refill plus concurrent retries recovers one order with exactly one key", async () => {
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME" });
  const order = await fixtures.createOrder(product.id);
  await fixtures.markOrderPaid(order.id);
  await fulfillment.fulfillPaidOrder(order.id);

  expect((await repository.getOrder(order.id)).status).toBe("out_of_stock");
  expect(await recovery.listRecoverableOrders()).toHaveLength(1);

  const refill = await recovery.refillInventory({
    sku: "KEY-CS2-PRIME",
    codes: ["RECOVERY-ONE", "RECOVERY-TWO"],
  });
  expect(refill).toMatchObject({ inserted: 2, ignored: 0 });

  const results = await Promise.all(
    Array.from({ length: 50 }, () => recovery.retryOrder(order.id)),
  );
  expect(results.every((result) => result.status === "delivered")).toBe(true);
  expect(await repository.countFulfillments(order.id)).toBe(1);
  expect(await repository.countAssignedKeys(order.id)).toBe(1);
});

test("retrying a delivered order is a no-op and consumes no second key", async () => {
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME" });
  const order = await fixtures.createOrder(product.id);
  await fixtures.markOrderPaid(order.id);
  await fixtures.createKey(product.id, "FIRST-KEY");
  await fixtures.createKey(product.id, "SECOND-KEY");
  const delivered = await fulfillment.fulfillPaidOrder(order.id);

  const retry = await recovery.retryOrder(order.id);
  expect(retry.issuedCode).toBe(delivered.issuedCode);
  expect(await repository.countAssignedKeys(order.id)).toBe(1);
});
