import { initAdmin } from "./ui/admin.js";
import { initCarousel } from "./ui/carousel.js";
import { initCatalogMenu } from "./ui/catalog-menu.js";
import { initCheckout } from "./ui/checkout.js";
import { initCurrencySwitcher } from "./ui/currency-switcher.js";
import { initHoverStates } from "./ui/hover-states.js";
import { renderProducts, updateProductPrices } from "./ui/product-catalog.js";

const productsRoot = document.querySelector("#products");
renderProducts(productsRoot);
initCatalogMenu();
initCarousel(document.querySelector(".hero"));
initCurrencySwitcher(document.querySelector(".header-actions"), (currency) => updateProductPrices(productsRoot, currency));
initHoverStates();
initCheckout();
initAdmin();

document.querySelector("[data-copy-promo]")?.addEventListener("click", async (event) => {
  await navigator.clipboard.writeText("WELCOME10");
  event.currentTarget.textContent = "Промокод скопирован";
});
