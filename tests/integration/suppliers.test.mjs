import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test } from "vitest";
import { SupplierRepository } from "../../server/db/supplier-repository.mjs";
import { FulfillmentService } from "../../server/domain/fulfillment-service.mjs";
import { SupplierService } from "../../server/domain/supplier-service.mjs";
import { createTestPool, databaseFixtures } from "../helpers/postgres.mjs";

const pool = createTestPool();
const fixtures = databaseFixtures(pool);
const suppliers = new SupplierService({ pool });
const repository = new SupplierRepository(pool);

beforeEach(async () => {
  await fixtures.reset();
});

afterAll(async () => {
  await pool.end();
});

test("repeating a timed-out supplier request returns the same persisted code", async () => {
  const request = {
    provider: "A",
    requestId: "req_stable",
    sku: "STEAM-TOPUP-500",
    orderId: "ord_stable",
  };

  await expect(
    suppliers.issueFromSupplier({ ...request, behavior: "timeout_after_issue" }),
  ).rejects.toMatchObject({ code: "SUPPLIER_TIMEOUT" });

  const replay = await suppliers.issueFromSupplier(request);
  expect(replay).toMatchObject({
    status: "ok",
    request_id: "req_stable",
    provider: "A",
  });
  expect(await repository.distinctCodesForRequest("A", "req_stable")).toBe(1);
});

test("an explicit A failure permits fulfillment to fall back to B", async () => {
  const product = await fixtures.createProduct({
    sku: "STEAM-TOPUP-500",
    price: 55000,
  });
  await pool.query(
    "UPDATE products SET fulfillment_mode = 'supplier' WHERE id = $1",
    [product.id],
  );
  const order = await fixtures.createOrder(product.id, { total: 55000 });
  await fixtures.markOrderPaid(order.id);
  const fulfillment = new FulfillmentService({ pool, supplierService: suppliers });

  const result = await fulfillment.fulfillPaidOrder(order.id, {
    supplierBehaviors: { A: "fail_5xx" },
  });

  expect(result).toMatchObject({ status: "delivered" });
  const record = await repository.getFulfillment(order.id);
  expect(record).toMatchObject({ provider: "B", status: "delivered" });
  expect(await repository.countAttempts(order.id, "failed")).toBe(1);
  expect(await repository.countAttempts(order.id, "delivered")).toBe(1);
});

test("a supplier timeout is ambiguous and never falls back to B", async () => {
  const product = await fixtures.createProduct({ sku: `SUP-${randomUUID()}`, price: 55000 });
  await pool.query(
    "UPDATE products SET fulfillment_mode = 'supplier' WHERE id = $1",
    [product.id],
  );
  const order = await fixtures.createOrder(product.id, { total: 55000 });
  await fixtures.markOrderPaid(order.id);
  const fulfillment = new FulfillmentService({ pool, supplierService: suppliers });

  const first = await fulfillment.fulfillPaidOrder(order.id, {
    supplierBehaviors: { A: "timeout_after_issue" },
  });
  expect(first).toMatchObject({ status: "delivery_failed" });
  expect(await repository.countProviderRequests(order.id, "B")).toBe(0);

  const retry = await fulfillment.fulfillPaidOrder(order.id);
  expect(retry).toMatchObject({ status: "delivered" });
  expect(await repository.countProviderRequests(order.id, "A")).toBe(1);
});
