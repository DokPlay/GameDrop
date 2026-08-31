const rates = { RUB: 1, USD: 0.011, KZT: 5.4 };
const locales = { RUB: "ru-RU", USD: "en-US", KZT: "ru-KZ" };

export function formatMoney(minorRub, currency = "RUB") {
  const value = (minorRub / 100) * rates[currency];
  return new Intl.NumberFormat(locales[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "RUB" ? 0 : 2,
  }).format(value);
}

export function initCurrencySwitcher(root, onChange) {
  const controls = document.createElement("div");
  controls.className = "currency-switcher";
  controls.setAttribute("aria-label", "Валюта отображения");
  const labels = { RUB: "Рубли", USD: "Доллары", KZT: "Тенге" };
  Object.entries(labels).forEach(([currency, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(currency === "RUB"));
    button.textContent = currency === "RUB" ? "₽" : currency === "USD" ? "$" : "₸";
    button.addEventListener("click", () => {
      controls.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      onChange(currency);
    });
    controls.append(button);
  });
  root.prepend(controls);
}
