import { api } from "../api/client.js";
import { formatMoney } from "./currency-switcher.js";
import { products } from "./product-catalog.js";
import { renderOrderStatus } from "./order-status.js";

export function initCheckout() {
  const dialog = document.querySelector("[data-checkout-dialog]");
  const form = dialog.querySelector("[data-checkout-form]");
  const progress = dialog.querySelector("[data-order-progress]");
  let selected = products[0];

  function open(sku) {
    selected = products.find((product) => product.sku === sku) ?? products[0];
    dialog.querySelector("[data-checkout-title]").textContent = selected.title;
    dialog.querySelector("[data-checkout-image]").src = selected.image;
    dialog.querySelector("[data-checkout-image]").alt = `Обложка ${selected.title}`;
    dialog.querySelector("[data-checkout-price]").textContent = formatMoney(selected.price);
    form.hidden = false;
    progress.hidden = true;
    progress.className = "order-progress";
    dialog.showModal();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-checkout]");
    if (button) open(button.dataset.openCheckout);
  });
  dialog.querySelector("[data-close-checkout]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "Создаём заказ…";
    progress.hidden = false;
    progress.innerHTML = "<strong>Создаём защищённый заказ…</strong>";
    try {
      const promoCode = new FormData(form).get("promo_code")?.trim();
      const order = await api.createOrder({ client_request_id: crypto.randomUUID(), sku: selected.sku, ...(promoCode ? { promo_code: promoCode } : {}) });
      progress.innerHTML = "<strong>Платёж принят, выдаём товар…</strong>";
      const paid = await api.payOrder(order.id);
      form.hidden = true;
      renderOrderStatus(progress, paid);
    } catch (error) {
      progress.innerHTML = `<strong>Не удалось завершить покупку</strong><p>${error.code ?? "ERROR"}: ${error.message}</p>`;
    } finally {
      submit.disabled = false;
      submit.textContent = "Создать заказ и оплатить";
    }
  });
}
