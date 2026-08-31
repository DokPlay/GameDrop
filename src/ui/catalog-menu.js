export function initCatalogMenu() {
  const button = document.querySelector(".catalog-button");
  const menu = document.querySelector("#catalog-menu");
  const closeButton = menu.querySelector(".catalog-close");
  const title = menu.querySelector("[data-catalog-title]");
  const count = menu.querySelector("[data-catalog-count]");
  const columns = menu.querySelector("[data-catalog-columns]");
  const categories = {
    games: {
      title: "Игры и сервисы",
      count: "847 направлений",
      columns: [
        ["Популярное", ["Steam", "Roblox", "Telegram", "ChatGPT"]],
        ["Игры", ["Counter-Strike 2", "Brawl Stars", "PUBG Mobile", "Mobile Legends"]],
        ["Подписки", ["PlayStation Plus", "App Store", "TikTok Coins", "Другие сервисы"]],
      ],
    },
    keys: {
      title: "Ключи активации",
      count: "126 предложений",
      columns: [
        ["Популярное", ["Counter-Strike 2", "Wildcat Gun Machine", "Zombie Army 4"]],
        ["Платформы", ["Steam", "Epic Games", "PlayStation", "Xbox"]],
        ["Формат", ["Моментальная выдача", "Регион РФ и СНГ", "Глобальные ключи", "Новинки"]],
      ],
    },
    currency: {
      title: "Игровая валюта",
      count: "94 направления",
      columns: [
        ["Популярное", ["Пополнение Steam", "Robux", "PUBG UC", "Brawl Stars Gems"]],
        ["Игры", ["Mobile Legends", "Genshin Impact", "Fortnite V-Bucks", "Valorant Points"]],
        ["Условия", ["Безопасная оплата", "Быстрая доставка", "Поддержка 24/7", "Все направления"]],
      ],
    },
    subscriptions: {
      title: "Подписки",
      count: "73 предложения",
      columns: [
        ["Игровые", ["PlayStation Plus", "Xbox Game Pass", "EA Play", "Nintendo Online"]],
        ["Приложения", ["ChatGPT", "Discord Nitro", "Telegram Premium", "Spotify"]],
        ["Период", ["1 месяц", "3 месяца", "6 месяцев", "12 месяцев"]],
      ],
    },
    accounts: {
      title: "Аккаунты",
      count: "58 предложений",
      columns: [
        ["Игры", ["Steam", "Epic Games", "PlayStation", "Xbox"]],
        ["Сервисы", ["ChatGPT", "Telegram", "TikTok", "App Store"]],
        ["Гарантии", ["Проверенные продавцы", "Защита сделки", "Отзывы", "Поддержка"]],
      ],
    },
  };

  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("catalog-open", open);
  }

  button.addEventListener("click", () => setOpen(menu.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  menu.addEventListener("click", (event) => {
    const categoryButton = event.target.closest("[data-catalog-category]");
    if (categoryButton) {
      const selected = categories[categoryButton.dataset.catalogCategory];
      menu.querySelectorAll("[data-catalog-category]").forEach((item) => {
        const active = item === categoryButton;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      title.textContent = selected.title;
      count.textContent = selected.count;
      columns.innerHTML = selected.columns.map(([heading, links]) => `<section><h3>${heading}</h3>${links.map((link) => `<a href="#products">${link}</a>`).join("")}</section>`).join("");
      return;
    }
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
}
