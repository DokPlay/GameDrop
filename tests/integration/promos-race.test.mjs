import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import { OrderService } from "../../server/domain/order-service.mjs";
import { OrderRepository } from "../../server/db/order-repository.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const service = new OrderService({ pool });
const repository = new OrderRepository(pool);

beforeEach(async () => {
  await fixtures.reset();
  await fixtures.createProduct({ sku: "KEY-CS2-PRIME", price: 129000 });
  await fixtures.createPromo({ code: "LIMIT3", discountValue: 50, maxUses: 3 });
});

afterAll(async () => {
  await pool.end();
});

test("never exceeds a promo max-use cap under 50 concurrent orders", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 50 }, () => service.createOrder({
      clientRequestId: randomUUID(),
      sku: "KEY-CS2-PRIME",
      promoCode: "LIMIT3",
    })),
  );

  expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(3);
  expect(results.filter((item) => item.status === "rejected")).toHaveLength(47);
  expect(await repository.countRedemptions("LIMIT3")).toBe(3);
});
