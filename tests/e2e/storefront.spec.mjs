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
  await page.getByRole("button", { name: "Доллары" }).click();
  await expect(page.getByRole("button", { name: "Доллары" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Рубли" })).toHaveAttribute(
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
