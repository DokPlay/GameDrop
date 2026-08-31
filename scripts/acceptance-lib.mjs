import { randomUUID } from "node:crypto";
import { createApplication } from "../server/app.mjs";

async function assertTestDatabase(pool) {
  const { rows } = await pool.query("SELECT current_database() AS name");
  if (!/test/i.test(rows[0].name)) {
    throw new Error(`Acceptance runner refuses to truncate non-test database: ${rows[0].name}`);
  }
}

async function reset(pool) {
  await assertTestDatabase(pool);
  await pool.query(`
    TRUNCATE TABLE
      fulfillment_attempts, supplier_requests, pending_payment_events,
      payment_events, fulfillment_records, inventory_keys, promo_redemptions,
      orders, promos, products
    RESTART IDENTITY
  `);
}

async function insertProduct(pool, overrides = {}) {
  const product = { id: randomUUID(), sku: overrides.sku ?? "KEY-CS2-PRIME", price: overrides.price ?? 129000, mode: overrides.mode ?? "pool" };
  await pool.query(
    `INSERT INTO products (id, sku, name, description, price_minor, currency, fulfillment_mode, active)
     VALUES ($1, $2, $3, 'Acceptance fixture', $4, 'RUB', $5, true)`,
    [product.id, product.sku, `Acceptance ${product.sku}`, product.price, product.mode],
  );
  return product;
}

async function insertKey(pool, productId, code) {
  await pool.query("INSERT INTO inventory_keys (id, product_id, code) VALUES ($1, $2, $3)", [randomUUID(), productId, code]);
}

async function insertPromo(pool, code, maxUses) {
  await pool.query(
    `INSERT INTO promos (id, code, discount_type, discount_value, max_uses, used_count, active)
     VALUES ($1, $2, 'percent', 10, $3, 0, true)`,
    [randomUUID(), code, maxUses],
  );
}

function paidEvent(orderId, eventId) {
  return { event_id: eventId, order_id: orderId, status: "paid", amount: 129000, currency: "RUB", created_at: new Date().toISOString() };
}

async function invariantCounts(pool, orderId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::integer FROM fulfillment_records WHERE order_id = $1) AS fulfillment_facts,
       (SELECT count(*)::integer FROM inventory_keys WHERE assigned_order_id = $1) AS consumed_keys,
       (SELECT status FROM orders WHERE id = $1) AS status`,
    [orderId],
  );
  return rows[0];
}

export async function runParallelWebhookRace({ pool }) {
  await reset(pool);
  const product = await insertProduct(pool);
  await insertKey(pool, product.id, "RACE-WEBHOOK-KEY");
  const app = createApplication({ pool, adminToken: "acceptance" });
  const order = await app.orderService.createOrder({ clientRequestId: randomUUID(), sku: product.sku });
  await Promise.all(Array.from({ length: 50 }, (_, index) => app.paymentService.acceptPaymentEvent(paidEvent(order.id, `evt_race_${index}`))));
  const counts = await invariantCounts(pool, order.id);
  return { fulfillmentFacts: counts.fulfillment_facts, consumedKeys: counts.consumed_keys, status: counts.status };
}

export async function runDuplicateEvent({ pool }) {
  await reset(pool);
  const product = await insertProduct(pool);
  await insertKey(pool, product.id, "DUPLICATE-EVENT-KEY");
  const app = createApplication({ pool, adminToken: "acceptance" });
  const order = await app.orderService.createOrder({ clientRequestId: randomUUID(), sku: product.sku });
  const event = paidEvent(order.id, "evt_same_id");
  await app.paymentService.acceptPaymentEvent(event);
  await app.paymentService.acceptPaymentEvent(event);
  const counts = await invariantCounts(pool, order.id);
  const events = await pool.query("SELECT count(*)::integer AS count FROM payment_events WHERE event_id = $1", [event.event_id]);
  return { eventRows: events.rows[0].count, fulfillmentFacts: counts.fulfillment_facts, consumedKeys: counts.consumed_keys };
}

export async function runEarlyWebhook({ pool }) {
  await reset(pool);
  const product = await insertProduct(pool);
  await insertKey(pool, product.id, "EARLY-WEBHOOK-KEY");
  const app = createApplication({ pool, adminToken: "acceptance" });
  const orderId = randomUUID();
  await app.paymentService.acceptPaymentEvent(paidEvent(orderId, "evt_early"));
  await app.orderService.createOrder({ clientRequestId: orderId, sku: product.sku });
  const counts = await invariantCounts(pool, orderId);
  return { fulfillmentFacts: counts.fulfillment_facts, deliveredKeys: counts.consumed_keys, status: counts.status };
}

export async function runRecoveryRace({ pool }) {
  await reset(pool);
  const product = await insertProduct(pool);
  const app = createApplication({ pool, adminToken: "acceptance" });
  const order = await app.orderService.createOrder({ clientRequestId: randomUUID(), sku: product.sku });
  await app.paymentService.acceptPaymentEvent(paidEvent(order.id, "evt_recovery"));
  await app.recoveryService.refillInventory({ sku: product.sku, codes: ["RECOVERY-RACE-KEY"] });
  await Promise.all(Array.from({ length: 50 }, () => app.recoveryService.retryOrder(order.id)));
  const counts = await invariantCounts(pool, order.id);
  return { fulfillmentFacts: counts.fulfillment_facts, deliveredKeys: counts.consumed_keys, status: counts.status };
}

export async function runPromoRace({ pool }) {
  await reset(pool);
  const product = await insertProduct(pool);
  await insertPromo(pool, "LIMIT3", 3);
  const app = createApplication({ pool, adminToken: "acceptance" });
  const results = await Promise.allSettled(Array.from({ length: 50 }, () => app.orderService.createOrder({ clientRequestId: randomUUID(), sku: product.sku, promoCode: "LIMIT3" })));
  const { rows } = await pool.query(
    `SELECT promos.max_uses,
       (SELECT count(*)::integer FROM promo_redemptions WHERE promo_id = promos.id) AS redemptions
     FROM promos WHERE code = 'LIMIT3'`,
  );
  return { redemptions: rows[0].redemptions, maxUses: rows[0].max_uses, fulfilledOrders: results.filter((result) => result.status === "fulfilled").length };
}

export async function runAcceptance({ pool }) {
  return {
    parallelWebhooks: await runParallelWebhookRace({ pool }),
    duplicateEvent: await runDuplicateEvent({ pool }),
    earlyWebhook: await runEarlyWebhook({ pool }),
    recovery: await runRecoveryRace({ pool }),
    promo: await runPromoRace({ pool }),
  };
}
