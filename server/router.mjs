import { randomUUID } from "node:crypto";
import { DomainError } from "./domain/errors.mjs";
import { isAdminAuthorized } from "./http/admin-auth.mjs";
import { normalizePath } from "./http/request.mjs";
import { json, serializeOrder } from "./http/response.mjs";

function routeMatch(path, pattern) {
  const match = path.match(pattern);
  return match?.groups ?? null;
}

function adminGuard(request, dependencies) {
  return isAdminAuthorized(request.headers, dependencies.adminToken)
    ? null
    : json(401, { error: "UNAUTHORIZED", message: "A valid admin bearer token is required" });
}

export function createRouter(dependencies) {
  return {
    async handle(request) {
      const method = request.method.toUpperCase();
      const path = normalizePath(request.path);
      const body = request.body ?? {};

      try {
        if (method === "OPTIONS") {
          return { status: 204, headers: { allow: "GET, POST, OPTIONS" }, body: null };
        }
        if (method === "GET" && path === "/api/health") {
          return json(200, { status: "ok", service: "gamedrop" });
        }
        if (method === "GET" && path === "/api/products") {
          return json(200, { products: await dependencies.productService.listProducts() });
        }
        if (method === "POST" && path === "/api/orders") {
          const order = await dependencies.orderService.createOrder({
            clientRequestId: body.client_request_id,
            sku: body.sku,
            promoCode: body.promo_code,
          });
          return json(201, serializeOrder(order));
        }

        const payRoute = routeMatch(path, /^\/api\/orders\/(?<orderId>[^/]+)\/pay$/);
        if (method === "POST" && payRoute) {
          const order = await dependencies.orderService.getOrder(payRoute.orderId);
          await dependencies.paymentService.acceptPaymentEvent({
            event_id: body.event_id ?? `evt_${randomUUID()}`,
            order_id: order.id,
            status: "paid",
            amount: order.total,
            currency: order.currency,
            created_at: new Date().toISOString(),
          });
          return json(200, serializeOrder(await dependencies.orderService.getOrder(order.id)));
        }

        const orderRoute = routeMatch(path, /^\/api\/orders\/(?<orderId>[^/]+)$/);
        if (method === "GET" && orderRoute) {
          return json(200, serializeOrder(
            await dependencies.orderService.getOrder(orderRoute.orderId),
          ));
        }
        if (method === "POST" && path === "/api/payments/webhook") {
          const result = await dependencies.paymentService.acceptPaymentEvent(body);
          return json(result.pending ? 202 : 200, result);
        }

        const supplierRoute = routeMatch(path, /^\/api\/suppliers\/(?<provider>A|B)\/issue$/);
        if (method === "POST" && supplierRoute) {
          const result = await dependencies.supplierService.issueFromSupplier({
            provider: supplierRoute.provider,
            requestId: body.request_id,
            sku: body.sku,
            orderId: body.order_id,
            behavior: body.behavior,
          });
          return json(200, result);
        }

        if (path.startsWith("/api/admin/")) {
          const denied = adminGuard(request, dependencies);
          if (denied) {
            return denied;
          }
        }
        if (method === "GET" && path === "/api/admin/orders") {
          const orders = await dependencies.recoveryService.listRecoverableOrders();
          return json(200, { orders: orders.map(serializeOrder) });
        }

        const retryRoute = routeMatch(path, /^\/api\/admin\/orders\/(?<orderId>[^/]+)\/retry$/);
        if (method === "POST" && retryRoute) {
          const order = await dependencies.recoveryService.retryOrder(retryRoute.orderId);
          return json(200, serializeOrder(order));
        }
        if (method === "POST" && path === "/api/admin/inventory/refill") {
          return json(200, await dependencies.recoveryService.refillInventory({
            sku: body.sku,
            codes: body.codes,
          }));
        }

        return json(404, { error: "NOT_FOUND", message: "API route does not exist" });
      } catch (error) {
        if (error instanceof DomainError) {
          return json(error.httpStatus, { error: error.code, message: error.message });
        }
        return json(500, {
          error: "INTERNAL_ERROR",
          message: "Unexpected server error",
        });
      }
    },
  };
}
