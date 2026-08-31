import { expect, test, vi } from "vitest";
import { createRouter } from "../../server/router.mjs";

function dependencies() {
  return {
    orderService: {
      createOrder: vi.fn(async () => ({
        id: "ord-1",
        clientRequestId: "req-1",
        sku: "KEY-CS2-PRIME",
        subtotal: 129000,
        discount: 0,
        total: 129000,
        currency: "RUB",
        status: "created",
        issuedCode: null,
      })),
      getOrder: vi.fn(),
    },
    paymentService: { acceptPaymentEvent: vi.fn() },
    supplierService: { issueFromSupplier: vi.fn() },
    recoveryService: {
      listRecoverableOrders: vi.fn(async () => []),
      retryOrder: vi.fn(),
      refillInventory: vi.fn(),
    },
    productService: { listProducts: vi.fn(async () => []) },
    adminToken: "test-admin-token",
  };
}

test("POST /api/orders returns a server-priced order", async () => {
  const deps = dependencies();
  const router = createRouter(deps);
  const response = await router.handle({
    method: "POST",
    path: "/api/orders",
    headers: {},
    body: { client_request_id: "req-1", sku: "KEY-CS2-PRIME", price: 1 },
  });

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    sku: "KEY-CS2-PRIME",
    total: 129000,
    currency: "RUB",
    status: "created",
  });
  expect(deps.orderService.createOrder).toHaveBeenCalledWith({
    clientRequestId: "req-1",
    sku: "KEY-CS2-PRIME",
    promoCode: undefined,
  });
});

test("admin routes reject a missing bearer token", async () => {
  const router = createRouter(dependencies());
  const response = await router.handle({
    method: "GET",
    path: "/api/admin/orders",
    headers: {},
    query: new URLSearchParams(),
  });

  expect(response).toMatchObject({ status: 401, body: { error: "UNAUTHORIZED" } });
});

test("unknown API routes return JSON 404", async () => {
  const router = createRouter(dependencies());
  const response = await router.handle({
    method: "GET",
    path: "/api/does-not-exist",
    headers: {},
  });

  expect(response).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
});
