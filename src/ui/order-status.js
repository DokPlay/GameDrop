const labels = { created: "Заказ создан", paid: "Платёж подтверждён", delivering: "Получаем ключ", delivered: "Ключ выдан", out_of_stock: "Ожидает пополнения склада", delivery_failed: "Выдачу можно повторить", payment_failed: "Платёж не прошёл" };

export function renderOrderStatus(root, order) {
  root.hidden = false;
  root.classList.toggle("is-success", order.status === "delivered");
  root.innerHTML = `<strong>${labels[order.status] ?? order.status}</strong><p>Заказ <code>${order.id}</code></p>${order.last_error ? `<p>${order.last_error.code}: ${order.last_error.detail ?? ""}</p>` : ""}${order.issued_code ? `<div class="order-key"><span>${order.issued_code}</span><button type="button" data-copy-key>Копировать</button></div>` : ""}`;
  root.querySelector("[data-copy-key]")?.addEventListener("click", () => navigator.clipboard.writeText(order.issued_code));
}
