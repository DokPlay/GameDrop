import { formatMoney } from "./currency-switcher.js";
import { products } from "./product-catalog.js";

function itemLabel(count) {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return "товаров";
  if (remainder10 === 1) return "товар";
  if (remainder10 >= 2 && remainder10 <= 4) return "товара";
  return "товаров";
}

export function initStorefrontControls(productsRoot) {
  const search = document.querySelector(".search-box input");
  const filters = [...document.querySelectorAll("[data-product-filter]")];
  const empty = productsRoot.querySelector(".catalog-empty");
  const favoritesButton = document.querySelector(".favorites-button");
  const cartButton = document.querySelector(".cart-button");
  const popover = document.querySelector("#header-popover");
  const popoverContent = popover.querySelector("[data-popover-content]");
  const favorites = new Set();
  const steamCurrencies = [...document.querySelectorAll("[data-steam-currency]")];
  const steamAmount = document.querySelector("[data-steam-amount]");
  const steamPay = document.querySelector(".steam-pay");
  let activeCategory = filters.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.productFilter ?? "all";

  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase("ru-RU");
    let visibleCount = 0;

    productsRoot.querySelectorAll(".product-card").forEach((card) => {
      const matchesQuery = !query || card.dataset.title.includes(query);
      const matchesCategory = activeCategory === "all"
        || card.dataset.categories.split(" ").includes(activeCategory);
      card.hidden = !(matchesQuery && matchesCategory);
      if (!card.hidden) visibleCount += 1;
    });

    productsRoot.querySelectorAll(".product-section").forEach((section) => {
      section.hidden = !section.querySelector(".product-card:not([hidden])");
    });
    empty.hidden = visibleCount > 0;
  }

  function closePopover({ restoreFocus = false } = {}) {
    if (popover.hidden) return;
    const activeButton = favoritesButton.getAttribute("aria-expanded") === "true"
      ? favoritesButton
      : cartButton;
    popover.hidden = true;
    favoritesButton.setAttribute("aria-expanded", "false");
    cartButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) activeButton.focus();
  }

  function openPopover(button, label, html) {
    const wasOpen = !popover.hidden && button.getAttribute("aria-expanded") === "true";
    closePopover();
    if (wasOpen) return;
    popover.setAttribute("aria-label", label);
    popoverContent.innerHTML = html;
    popover.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function renderFavoritesPopover() {
    if (!favorites.size) {
      return "<strong>Избранное пока пусто</strong><p>Отмечайте товары сердцем, чтобы быстро вернуться к ним.</p>";
    }
    const items = products.filter((product) => favorites.has(product.sku));
    return `<strong>Избранные товары</strong><ul>${items.map((product) => `<li><img src="${product.image}" alt="" /><span>${product.title}</span><button type="button" data-open-checkout="${product.sku}">Купить</button></li>`).join("")}</ul>`;
  }

  function syncFavoriteButtons(sku, selected) {
    productsRoot.querySelectorAll(`.product-card[data-sku="${sku}"] .favorite`).forEach((button) => {
      const title = products.find((product) => product.sku === sku)?.title ?? sku;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `${selected ? "Удалить" : "Добавить"} ${title} ${selected ? "из избранного" : "в избранное"}`);
    });
    const count = favorites.size;
    favoritesButton.setAttribute("aria-label", `Избранное, ${count} ${itemLabel(count)}`);
  }

  search.addEventListener("input", applyFilters);
  filters.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.productFilter;
      filters.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      applyFilters();
    });
  });
  steamCurrencies.forEach((button) => {
    button.addEventListener("click", () => {
      const currency = button.dataset.steamCurrency;
      steamCurrencies.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      const formatted = formatMoney(50000, currency);
      steamAmount.textContent = formatted;
      steamPay.textContent = `Оплатить ${formatted}`;
      const displayCurrency = { RUB: "Рубли", USD: "Доллары", KZT: "Тенге" }[currency];
      document.querySelector(`.currency-switcher [aria-label="${displayCurrency}"]`)?.click();
    });
  });

  productsRoot.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest(".favorite");
    if (favoriteButton) {
      const sku = favoriteButton.closest(".product-card").dataset.sku;
      const selected = !favorites.has(sku);
      if (selected) favorites.add(sku);
      else favorites.delete(sku);
      syncFavoriteButtons(sku, selected);
      return;
    }

    if (event.target.closest("[data-show-all]")) {
      search.value = "";
      activeCategory = "all";
      filters.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-pressed", "false");
      });
      applyFilters();
    }
  });

  favoritesButton.addEventListener("click", () => {
    openPopover(favoritesButton, "Избранные товары", renderFavoritesPopover());
  });
  cartButton.addEventListener("click", () => {
    openPopover(
      cartButton,
      "Корзина",
      "<strong>Корзина пока пуста</strong><p>Выберите товар и оформите его безопасной покупкой.</p>",
    );
  });
  document.addEventListener("pointerdown", (event) => {
    if (!popover.hidden && !popover.contains(event.target) && !event.target.closest(".header-actions")) {
      closePopover();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popover.hidden) closePopover({ restoreFocus: true });
  });

  applyFilters();
}
