import "@fontsource/montserrat/cyrillic-400.css";
import "@fontsource/montserrat/cyrillic-600.css";
import "@fontsource/montserrat/cyrillic-700.css";
import "@fontsource/montserrat/cyrillic-800.css";
import { initAdmin } from "./ui/admin.js";
import { initCarousel } from "./ui/carousel.js";
import { initCatalogMenu } from "./ui/catalog-menu.js";
import { initCheckout } from "./ui/checkout.js";
import { initCurrencySwitcher } from "./ui/currency-switcher.js";
import { initHoverStates } from "./ui/hover-states.js";
import { renderIcons } from "./ui/icons.js";
import { renderProducts, updateProductPrices } from "./ui/product-catalog.js";
import { initStorefrontControls } from "./ui/storefront-controls.js";

const productsRoot = document.querySelector("#products");
renderProducts(productsRoot);
initCatalogMenu();
initCarousel(document.querySelector(".hero"));
initCurrencySwitcher(document.querySelector(".header-actions"), (currency) => updateProductPrices(productsRoot, currency));
initStorefrontControls(productsRoot);
initHoverStates();
initCheckout();
initAdmin();
renderIcons();

document.querySelectorAll("[data-copy-promo]").forEach((button) => {
  button.addEventListener("click", async (event) => {
    const target = event.currentTarget;
    try {
      await navigator.clipboard.writeText("WELCOME10");
    } catch {
      // Clipboard access can be denied in a preview iframe; the UI still confirms the code.
    }
    const state = target.querySelector("[data-promo-state]");
    if (state) state.textContent = "Скопировано";
    else target.textContent = "Промокод скопирован";
  });
});
