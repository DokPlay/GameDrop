export function json(status, body, headers = {}) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
    body,
  };
}

export function serializeOrder(order) {
  return {
    id: order.id,
    client_request_id: order.clientRequestId,
    sku: order.sku,
    product_name: order.productName,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    currency: order.currency,
    status: order.status,
    issued_code: order.issuedCode,
    last_error: order.lastError,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    ...(order.attempts ? { attempts: order.attempts } : {}),
  };
}
