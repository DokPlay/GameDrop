import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import { OrderService } from "../../server/domain/order-service.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const service = new OrderService({ pool });

beforeEach(async () => {
  await fixtures.reset();
  await fixtures.createProduct({ sku: "KEY-CS2-PRIME", price: 129000 });
  await fixtures.createPromo({ code: "WELCOME10", discountValue: 10, maxUses: 100 });
});

afterAll(async () => {
  await pool.end();
});

test("ignores a client supplied price and computes the discount on the server", async () => {
  const order = await service.createOrder({
    clientRequestId: randomUUID(),
    sku: "KEY-CS2-PRIME",
    promoCode: "welcome10",
    price: 1,
  });

  expect(order).toMatchObject({
    sku: "KEY-CS2-PRIME",
    subtotal: 129000,
    discount: 12900,
    total: 116100,
    currency: "RUB",
    status: "created",
  });
});

test("returns the same order for a repeated client request id", async () => {
  const clientRequestId = randomUUID();
  const first = await service.createOrder({ clientRequestId, sku: "KEY-CS2-PRIME" });
  const second = await service.createOrder({ clientRequestId, sku: "KEY-CS2-PRIME" });

  expect(second.id).toBe(first.id);
  expect(await service.getOrder(first.id)).toEqual(first);
});
