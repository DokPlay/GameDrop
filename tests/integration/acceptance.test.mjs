import { afterAll, expect, test } from "vitest";
import { runAcceptance } from "../../scripts/acceptance-lib.mjs";
import { createTestPool } from "../helpers/postgres.mjs";

const pool = createTestPool();

afterAll(async () => {
  await pool.end();
});

test("all five assignment acceptance criteria hold", async () => {
  const report = await runAcceptance({ pool });

  expect(report).toMatchObject({
    parallelWebhooks: { fulfillmentFacts: 1, consumedKeys: 1, status: "delivered" },
    duplicateEvent: { eventRows: 1, fulfillmentFacts: 1, consumedKeys: 1 },
    earlyWebhook: { fulfillmentFacts: 1, deliveredKeys: 1, status: "delivered" },
    recovery: { fulfillmentFacts: 1, deliveredKeys: 1, status: "delivered" },
    promo: { redemptions: 3, maxUses: 3, fulfilledOrders: 3 },
  });
});
