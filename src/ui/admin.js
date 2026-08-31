import { api } from "../api/client.js";

export function initAdmin() {
  const form = document.querySelector("[data-admin-login]");
  const content = document.querySelector("[data-admin-content]");
  let token = "";

  async function refresh() {
    content.hidden = false;
    content.textContent = "Загрузка…";
    try {
      const response = await api.listRecoverable(token);
      content.innerHTML = response.orders.length ? response.orders.map((order) => `<div class="admin-order"><div><strong>${order.sku}</strong><br /><small>${order.status} · ${order.id}</small></div><span>${order.last_error?.error ?? order.last_error?.code ?? "ожидает retry"}</span><button class="button button-dark" type="button" data-retry="${order.id}">Retry</button></div>`).join("") : "<strong>Все оплаченные заказы выданы.</strong> Нет задач для восстановления.";
    } catch (error) {
      content.innerHTML = `<strong>${error.code}</strong>: ${error.message}`;
    }
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); token = new FormData(form).get("token"); refresh(); });
  content.addEventListener("click", async (event) => { const button = event.target.closest("[data-retry]"); if (!button) return; button.disabled = true; try { await api.retryOrder(button.dataset.retry, token); await refresh(); } finally { button.disabled = false; } });
}
