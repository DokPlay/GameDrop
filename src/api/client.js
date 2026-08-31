async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message ?? `HTTP ${response.status}`);
    error.code = payload.error ?? "HTTP_ERROR";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  createOrder(input) { return request("/api/orders", { method: "POST", body: input }); },
  payOrder(orderId) { return request(`/api/orders/${orderId}/pay`, { method: "POST", body: {} }); },
  getOrder(orderId) { return request(`/api/orders/${orderId}`); },
  listRecoverable(token) { return request("/api/admin/orders", { headers: { authorization: `Bearer ${token}` } }); },
  retryOrder(orderId, token) { return request(`/api/admin/orders/${orderId}/retry`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: {} }); },
  refillInventory(input, token) { return request("/api/admin/inventory/refill", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: input }); },
};
