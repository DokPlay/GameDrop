import { expect, test } from "@playwright/test";

test("buyer creates an order, pays, and sees the issued key", async ({ page }) => {
  const orderId = "f62134e8-2069-4b61-8ee5-7d9d85e0f106";
  await page.route("**/api/orders", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: orderId,
        sku: "KEY-CS2-PRIME",
        subtotal: 129000,
        discount: 12900,
        total: 116100,
        currency: "RUB",
        status: "created",
        issued_code: null,
      }),
    });
  });
  await page.route(`**/api/orders/${orderId}/pay`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: orderId,
        sku: "KEY-CS2-PRIME",
        total: 116100,
        currency: "RUB",
        status: "delivered",
        issued_code: "CS2-PRIME-DEMO-0001",
      }),
    });
  });

  await page.goto("/");
  await page.locator("[data-product='KEY-CS2-PRIME']").getByRole("button", { name: "Купить" }).click();
  const dialog = page.getByRole("dialog", { name: /Counter-Strike 2/ });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Промокод").fill("WELCOME10");
  await dialog.getByRole("button", { name: "Создать заказ и оплатить" }).click();

  await expect(dialog).toContainText("Ключ выдан");
  await expect(dialog).toContainText("CS2-PRIME-DEMO-0001");
});

test("admin opens the recoverable-order list with a bearer token", async ({ page }) => {
  await page.route("**/api/admin/orders", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orders: [{
          id: "72cfcb9a-9392-49ae-b759-0bf148c3a184",
          sku: "KEY-CS2-PRIME",
          status: "out_of_stock",
          last_error: { code: "OUT_OF_STOCK" },
        }],
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("ADMIN_TOKEN").fill("demo-admin");
  await page.getByRole("button", { name: "Открыть" }).click();
  await expect(page.locator("[data-admin-content]")).toContainText("out_of_stock");
  await expect(page.locator("[data-admin-content]")).toContainText("OUT_OF_STOCK");
});
