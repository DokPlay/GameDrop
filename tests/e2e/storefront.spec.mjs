import { expect, test } from "@playwright/test";

test("catalog opens, toggles closed, and closes on an outside click", async ({ page }) => {
  await page.goto("/");
  const catalog = page.getByRole("dialog", { name: "Каталог товаров" });
  const button = page.getByRole("button", { name: "Каталог" });

  await button.click();
  await expect(catalog).toBeVisible();
  await button.click();
  await expect(catalog).toBeHidden();
  await button.click();
  await page.locator("main").click({ position: { x: 10, y: 700 } });
  await expect(catalog).toBeHidden();
});

test("carousel advances to the next promotional banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-slide='0']")).toHaveAttribute("aria-hidden", "false");
  await page.getByRole("button", { name: "Следующий баннер" }).click();
  await expect(page.locator("[data-slide='1']")).toHaveAttribute("aria-hidden", "false");
});

test("currency switcher exposes a persistent active state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Доллары", exact: true }).click();
  await expect(page.getByRole("button", { name: "Доллары", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Рубли", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("service and product cards expose their hover states", async ({ page }) => {
  await page.goto("/");
  const steam = page.locator("[data-service='steam']");
  await steam.hover();
  await expect(steam).toHaveClass(/is-hovered/);

  const product = page.locator("[data-product='KEY-CS2-PRIME']");
  await product.hover();
  await expect(product).toHaveClass(/is-hovered/);
});

test("Steam top-up block from the brief opens a matching checkout", async ({ page }) => {
  await page.goto("/");

  const steamTopup = page.getByRole("region", { name: "Пополнение Steam" });
  await expect(steamTopup).toBeVisible();
  await expect(steamTopup.getByLabel("Логин Steam")).toBeVisible();
  await expect(steamTopup).toContainText("500 ₽");

  const promo = steamTopup.getByRole("button", { name: "Скопировать промокод WELCOME10" });
  await expect(promo).toBeVisible();
  await promo.click();
  await expect(steamTopup).toContainText("Скопировано");
  const dollars = steamTopup.getByRole("button", { name: "Доллары для пополнения Steam" });
  await expect(dollars).toBeVisible();
  await dollars.click();
  await expect(dollars).toHaveAttribute("aria-pressed", "true");
  await steamTopup.getByRole("button", { name: "Рубли для пополнения Steam" }).click();

  await steamTopup.getByRole("button", { name: "Оплатить 500 ₽" }).click();
  await expect(page.getByRole("dialog", { name: /Пополнение Steam/ })).toBeVisible();
});

test("search and product-type pills filter the rendered catalog", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Поиск" }).fill("Zombie Army");
  await expect(page.locator(".product-card:visible")).toHaveCount(3);
  await expect(page.locator(".product-card:visible").first()).toContainText("Zombie Army 4");

  await page.getByRole("searchbox", { name: "Поиск" }).fill("");
  const currencyFilter = page.getByRole("button", { name: "Игровая валюта" });
  await currencyFilter.click();
  await expect(currencyFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-card:visible")).toHaveCount(3);
  await expect(page.locator(".product-card:visible").first()).toContainText("Пополнение Steam");
});

test("favorites and cart controls expose honest interactive states", async ({ page }) => {
  await page.goto("/");

  const firstFavorite = page.locator(".product-card").first().locator(".favorite");
  await firstFavorite.click();
  await expect(firstFavorite).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Избранное, 1 товар/ }).click();
  await expect(page.getByRole("region", { name: "Избранные товары" })).toContainText("Counter-Strike 2");

  await page.getByRole("button", { name: "Корзина" }).click();
  await expect(page.getByRole("region", { name: "Корзина" })).toContainText("Корзина пока пуста");
});

test("catalog categories update the selected content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Каталог" }).click();

  const category = page.getByRole("button", { name: /Ключи активации/ });
  await category.click();
  await expect(category).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#catalog-menu h2")).toHaveText("Ключи активации");
  await expect(page.locator("#catalog-menu")).toContainText("Counter-Strike 2");
});
