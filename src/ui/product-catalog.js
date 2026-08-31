import { formatMoney } from "./currency-switcher.js";

export const products = [
  { sku: "KEY-CS2-PRIME", title: "Counter-Strike 2 — Prime Status", price: 129000, oldPrice: 159000, image: "/assets/wildcat.png", tag: "Хит", categories: ["keys"] },
  { sku: "WILDCAT-GUN", title: "Wildcat Gun Machine", price: 99000, oldPrice: 199000, image: "/assets/wildcat.png", tag: "-50%", categories: ["keys", "items"] },
  { sku: "ROGUE-COMPANY", title: "Rogue Company — Epic Games", price: 59900, oldPrice: 89000, image: "/assets/rogue-company.png", tag: "Key", categories: ["keys"] },
  { sku: "ZOMBIE-ARMY-4", title: "Zombie Army 4: Dead War", price: 149000, oldPrice: 199000, image: "/assets/zombie-army.png", tag: "Steam", categories: ["keys"] },
  { sku: "STEAM-TOPUP-500", title: "Пополнение Steam — 500 ₽", price: 55000, oldPrice: 59000, image: "/assets/steam.png", tag: "Моментально", categories: ["keys", "currency", "donate"] },
];

const sections = ["Популярные товары", "Рекомендованные товары", "Другие товары"];

function productCard(product, currency, index, sectionIndex) {
  const sku = index === 0 ? product.sku : `${product.sku}-${index}`;
  const productSelector = sectionIndex === 0 && product.sku === "KEY-CS2-PRIME"
    ? product.sku
    : `${product.sku}-${sectionIndex}-${index}`;
  return `<article class="product-card" data-product="${productSelector}" data-sku="${product.sku}" data-title="${product.title.toLocaleLowerCase("ru-RU")}" data-categories="${product.categories.join(" ")}">
    <div class="product-image"><img src="${product.image}" alt="Обложка ${product.title}" /><span class="product-tag">${product.tag}</span><button class="favorite" type="button" aria-label="Добавить ${product.title} в избранное" aria-pressed="false"><i data-lucide="heart"></i></button></div>
    <div class="product-body"><h3>${product.title}</h3><div class="product-meta"><span><i data-lucide="circle-check"></i>В наличии</span><span><i data-lucide="zap"></i>Автовыдача</span></div><div class="product-price"><strong data-price="${product.price}">${formatMoney(product.price, currency)}</strong><del data-price="${product.oldPrice}">${formatMoney(product.oldPrice, currency)}</del></div><button class="buy-button" type="button" data-open-checkout="${product.sku}" data-instance="${sku}">Купить</button></div>
  </article>`;
}

export function renderProducts(root, currency = "RUB") {
  root.innerHTML = `${sections.map((title, sectionIndex) => {
    const rotated = [...products.slice(sectionIndex), ...products.slice(0, sectionIndex)];
    return `<section class="product-section" aria-labelledby="products-${sectionIndex}"><div class="section-heading"><div><p class="eyebrow">Проверенные продавцы</p><h2 id="products-${sectionIndex}">${title}</h2></div><a href="#products" data-show-all>Показать все <span aria-hidden="true">→</span></a></div><div class="product-grid">${rotated.map((product, index) => productCard(product, currency, index, sectionIndex)).join("")}</div></section>`;
  }).join("")}<div class="catalog-empty" role="status" hidden><i data-lucide="package-open"></i><strong>Ничего не найдено</strong><span>Попробуйте изменить запрос или выбрать другой тип товара.</span></div>`;
}

export function updateProductPrices(root, currency) {
  root.querySelectorAll("[data-price]").forEach((element) => {
    element.textContent = formatMoney(Number(element.dataset.price), currency);
  });
}
