import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import { FulfillmentRepository } from "../../server/db/fulfillment-repository.mjs";
import { PaymentRepository } from "../../server/db/payment-repository.mjs";
import { FulfillmentService } from "../../server/domain/fulfillment-service.mjs";
import { OrderService } from "../../server/domain/order-service.mjs";
import { PaymentService } from "../../server/domain/payment-service.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const fulfillment = new FulfillmentService({ pool });
const payments = new PaymentService({ pool, fulfillmentService: fulfillment });
const orders = new OrderService({ pool, paymentService: payments });
const fulfillmentRepository = new FulfillmentRepository(pool);
const paymentRepository = new PaymentRepository(pool);

function paymentEvent(overrides = {}) {
  return {
    event_id: overrides.eventId ?? `evt_${randomUUID()}`,
    order_id: overrides.orderId,
    status: overrides.status ?? "paid",
    amount: overrides.amount ?? 129000,
    currency: overrides.currency ?? "RUB",
    created_at: overrides.createdAt ?? new Date().toISOString(),
  };
}

beforeEach(async () => {
  await fixtures.reset();
  const product = await fixtures.createProduct({ sku: "KEY-CS2-PRIME", price: 129000 });
  await fixtures.createKey(product.id, "CS2-WEBHOOK-KEY");
});

afterAll(async () => {
  await pool.end();
});

test("stores an early paid webhook and applies it once after order creation", async () => {
  const externalOrderId = randomUUID();
  const accepted = await payments.acceptPaymentEvent(paymentEvent({ orderId: externalOrderId }));
  expect(accepted).toMatchObject({ accepted: true, pending: true, duplicate: false });

  const order = await orders.createOrder({
    clientRequestId: externalOrderId,
    sku: "KEY-CS2-PRIME",
  });

  expect((await orders.getOrder(order.id)).status).toBe("delivered");
  expect(await fulfillmentRepository.countFulfillments(order.id)).toBe(1);
  expect(await paymentRepository.countPending(externalOrderId)).toBe(0);
});

test("a duplicate event id changes neither fulfillment nor inventory", async () => {
  const order = await orders.createOrder({
    clientRequestId: randomUUID(),
    sku: "KEY-CS2-PRIME",
  });
  const event = paymentEvent({ orderId: order.id, eventId: "evt_duplicate" });

  await payments.acceptPaymentEvent(event);
  const duplicate = await payments.acceptPaymentEvent(event);

  expect(duplicate).toMatchObject({ accepted: true, duplicate: true, status: "delivered" });
  expect(await paymentRepository.countEvents("evt_duplicate")).toBe(1);
  expect(await fulfillmentRepository.countFulfillments(order.id)).toBe(1);
  expect(await fulfillmentRepository.countAssignedKeys(order.id)).toBe(1);
});

test("fifty parallel paid webhooks still issue exactly one key", async () => {
  const order = await orders.createOrder({
    clientRequestId: randomUUID(),
    sku: "KEY-CS2-PRIME",
  });

  await Promise.all(
    Array.from({ length: 50 }, (_, index) => payments.acceptPaymentEvent(paymentEvent({
      orderId: order.id,
      eventId: `evt_parallel_${index}`,
    }))),
  );

  expect((await orders.getOrder(order.id)).status).toBe("delivered");
  expect(await fulfillmentRepository.countFulfillments(order.id)).toBe(1);
  expect(await fulfillmentRepository.countAssignedKeys(order.id)).toBe(1);
});

test("a paid event recovers an earlier out-of-order failure", async () => {
  const order = await orders.createOrder({
    clientRequestId: randomUUID(),
    sku: "KEY-CS2-PRIME",
  });

  await payments.acceptPaymentEvent(paymentEvent({
    orderId: order.id,
    eventId: "evt_failed_first",
    status: "failed",
  }));
  expect((await orders.getOrder(order.id)).status).toBe("payment_failed");

  await payments.acceptPaymentEvent(paymentEvent({
    orderId: order.id,
    eventId: "evt_paid_later",
    status: "paid",
  }));
  expect((await orders.getOrder(order.id)).status).toBe("delivered");
});
