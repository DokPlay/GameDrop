# GameDrop Fullstack Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and deploy the complete GameDrop test assignment, including mandatory race-safe issuance and both recovery and promo-code bonus stages.

**Architecture:** A framework-free Vite storefront calls a single Node.js Netlify Function router. Domain services depend on a PostgreSQL repository; database transactions, row locks, conditional updates, and unique constraints enforce exactly-once behavior. Real PostgreSQL integration tests and standalone race scripts prove the acceptance scenarios.

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, Vite, Node.js 22, Netlify Functions, PostgreSQL, `pg`, Vitest, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-08-31-gamedrop-fullstack-design.md`

## Global Constraints

- Frontend production code must remain HTML/CSS/JavaScript without React, Next.js, Vue, or another heavy UI framework.
- Backend must expose a REST API and run in Node.js Netlify Functions.
- All monetary values are integer minor RUB units; totals and discounts are computed on the server.
- One key can never be assigned to two orders, and one order can never obtain two fulfillment records.
- Every feature follows RED → GREEN → REFACTOR; no production behavior is written before its test fails for the expected reason.
- Payment is a stub; Steam login is not implemented; admin authentication is a simple `ADMIN_TOKEN`.
- All mandatory stages and bonus stages 3–4 are in scope.

---

## File map

- `index.html`: storefront document and accessible landmarks.
- `src/styles/*.css`: tokens, layout, component states, responsive rules.
- `src/main.js`: browser bootstrap and controller wiring.
- `src/ui/`: carousel, catalog, currency, product, checkout, status, and admin controllers.
- `src/api/client.js`: browser REST client only.
- `netlify/functions/api.mjs`: Netlify entry point and HTTP adaptation.
- `server/router.mjs`: method/path matching with no framework.
- `server/domain/`: order, payment, fulfillment, supplier, promo, and status-transition services.
- `server/db/`: pool, transactions, repositories, migrations, and seed data.
- `server/http/`: validation, JSON responses, and admin-token guard.
- `tests/unit/`: pure service and router tests.
- `tests/integration/`: PostgreSQL concurrency and recovery tests.
- `tests/e2e/`: the five assessed storefront interactions and purchase flow.
- `scripts/`: migrations, seed, webhook race, and promo race commands.
- `public/assets/`: optimized assets extracted from the supplied Figma source.

---

### Task 1: Project foundation and executable test harness

**Files:**
- Create: `package.json`, `vite.config.js`, `netlify.toml`, `.env.example`, `eslint.config.js`
- Create: `tests/unit/health.test.mjs`, `server/health.mjs`
- Create: `scripts/test-env.mjs`

**Interfaces:**
- Produces: `health()` returning `{ status: "ok", service: "gamedrop" }` and npm scripts used by every later task.

- [ ] **Step 1: Write the failing health test**

```js
import { expect, test } from "vitest";
import { health } from "../../server/health.mjs";

test("reports the GameDrop service as healthy", () => {
  expect(health()).toEqual({ status: "ok", service: "gamedrop" });
});
```

- [ ] **Step 2: Install declared dependencies and verify RED**

Run: `pnpm install && pnpm vitest run tests/unit/health.test.mjs`

Expected: FAIL because `server/health.mjs` does not exist.

- [ ] **Step 3: Implement the minimal health function and configuration**

```js
export function health() {
  return { status: "ok", service: "gamedrop" };
}
```

Declare `dev`, `build`, `lint`, `test`, `test:unit`, `test:integration`, `test:e2e`, `db:migrate`, and `db:seed` scripts. Configure `/api/*` to the Netlify function and SPA fallback without intercepting API routes.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test:unit && pnpm build && pnpm lint`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.js netlify.toml .env.example eslint.config.js server tests scripts
git commit -m "chore: establish GameDrop project foundation"
```

### Task 2: PostgreSQL schema and transaction repository

**Files:**
- Create: `server/db/migrations/001_initial.sql`
- Create: `server/db/pool.mjs`, `server/db/transaction.mjs`, `server/db/order-repository.mjs`
- Create: `scripts/migrate.mjs`, `scripts/seed.mjs`
- Test: `tests/integration/schema.test.mjs`, `tests/helpers/postgres.mjs`

**Interfaces:**
- Produces: `withTransaction(fn)`, `OrderRepository`, and the tables/constraints named in the spec.
- Consumes: `DATABASE_URL` and optional `DATABASE_SSL`.

- [ ] **Step 1: Write a failing schema invariant test**

```js
test("database rejects assigning one inventory key to two orders", async () => {
  const first = await fixtures.createOrder();
  const second = await fixtures.createOrder();
  const key = await fixtures.createKey("KEY-CS2-PRIME");
  await sql`update inventory_keys set assigned_order_id = ${first.id} where id = ${key.id}`;
  await expect(sql`update inventory_keys set assigned_order_id = ${second.id} where id = ${key.id}`)
    .rejects.toMatchObject({ code: "23505" });
});
```

- [ ] **Step 2: Verify RED against an empty test database**

Run: `pnpm vitest run tests/integration/schema.test.mjs`

Expected: FAIL because `inventory_keys` does not exist.

- [ ] **Step 3: Add schema and migration runner**

Define UUID orders, integer money, enum-check status, unique `client_request_id`, unique `payment_events.event_id`, unique `inventory_keys.code`, unique nullable `inventory_keys.assigned_order_id`, unique `fulfillment_records.order_id`, unique `(provider, request_id)`, and promo constraints. Every foreign key uses an intentional delete policy; no cascade may erase payment or attempt history.

- [ ] **Step 4: Verify GREEN and repeatability**

Run: `pnpm db:migrate && pnpm db:migrate && pnpm vitest run tests/integration/schema.test.mjs`

Expected: both migrations succeed; test passes.

- [ ] **Step 5: Commit**

```bash
git add server/db scripts/migrate.mjs scripts/seed.mjs tests/integration tests/helpers
git commit -m "feat: add transactional PostgreSQL foundation"
```

### Task 3: Server-priced order creation and concurrency-safe promos

**Files:**
- Create: `server/domain/order-service.mjs`, `server/domain/promo-service.mjs`
- Modify: `server/db/order-repository.mjs`
- Test: `tests/integration/orders.test.mjs`, `tests/integration/promos-race.test.mjs`

**Interfaces:**
- Produces: `createOrder({ clientRequestId, sku, promoCode })` and `getOrder(orderId)`.
- Guarantees: repeated `clientRequestId` returns the same order; client price fields are ignored; promo usage never exceeds `max_uses`.

- [ ] **Step 1: Write the failing server-price test**

```js
test("ignores a client supplied price and computes the discount on the server", async () => {
  const order = await service.createOrder({
    clientRequestId: crypto.randomUUID(),
    sku: "KEY-CS2-PRIME",
    promoCode: "WELCOME10",
    price: 1,
  });
  expect(order).toMatchObject({ subtotal: 129000, discount: 12900, total: 116100, currency: "RUB" });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/orders.test.mjs`

Expected: FAIL because `createOrder` is missing.

- [ ] **Step 3: Implement atomic order and promo creation**

Use `INSERT ... ON CONFLICT (client_request_id) DO NOTHING`, then read the existing order. For a new promo order, conditionally increment `used_count` with `WHERE used_count < max_uses`, insert `promo_redemptions`, and create the order in the same transaction.

- [ ] **Step 4: Add and pass the N-limit race**

```js
const results = await Promise.allSettled(
  Array.from({ length: 50 }, () => service.createOrder({
    clientRequestId: crypto.randomUUID(), sku: "KEY-CS2-PRIME", promoCode: "LIMIT3",
  })),
);
expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(3);
expect(await repository.countRedemptions("LIMIT3")).toBe(3);
```

Run: `pnpm vitest run tests/integration/orders.test.mjs tests/integration/promos-race.test.mjs`

Expected: PASS repeatedly.

- [ ] **Step 5: Commit**

```bash
git add server/domain server/db/order-repository.mjs tests/integration
git commit -m "feat: create server-priced orders with atomic promos"
```

### Task 4: Exactly-once key-pool fulfillment

**Files:**
- Create: `server/domain/fulfillment-service.mjs`, `server/domain/status-machine.mjs`
- Create: `server/db/fulfillment-repository.mjs`
- Test: `tests/unit/status-machine.test.mjs`, `tests/integration/fulfillment-race.test.mjs`

**Interfaces:**
- Produces: `fulfillPaidOrder(orderId, options?)` and `transition(current, requested)`.
- Guarantees: one fulfillment row per order and one order per key.

- [ ] **Step 1: Write failing legal-transition tests**

```js
test.each([
  ["created", "paid"], ["paid", "delivering"], ["delivering", "delivered"],
  ["delivering", "out_of_stock"], ["delivering", "delivery_failed"],
  ["out_of_stock", "delivering"], ["delivery_failed", "delivering"],
])("allows %s -> %s", (from, to) => expect(transition(from, to)).toBe(to));

test("keeps delivered final", () => expect(transition("delivered", "delivering")).toBe("delivered"));
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/unit/status-machine.test.mjs`

Expected: FAIL because the status machine is missing.

- [ ] **Step 3: Implement the status machine and pool claim**

Inside one transaction lock the order, insert the unique fulfillment record, select one key using `FOR UPDATE SKIP LOCKED`, conditionally assign it, and finalize the order. An empty selection sets `out_of_stock` without rolling back the paid event.

- [ ] **Step 4: Prove the 50-way fulfillment race**

```js
await Promise.all(Array.from({ length: 50 }, () => service.fulfillPaidOrder(order.id)));
expect(await repository.countFulfillments(order.id)).toBe(1);
expect(await repository.countAssignedKeys(order.id)).toBe(1);
expect((await repository.getOrder(order.id)).status).toBe("delivered");
```

Run: `pnpm vitest run tests/unit/status-machine.test.mjs tests/integration/fulfillment-race.test.mjs --repeat=3`

Expected: PASS on every repeat.

- [ ] **Step 5: Commit**

```bash
git add server/domain server/db/fulfillment-repository.mjs tests
git commit -m "feat: guarantee exactly-once key fulfillment"
```

### Task 5: Idempotent and out-of-order payment webhooks

**Files:**
- Create: `server/domain/payment-service.mjs`, `server/db/payment-repository.mjs`
- Test: `tests/integration/payment-webhooks.test.mjs`

**Interfaces:**
- Produces: `acceptPaymentEvent(payload)` and `processPendingPayments(orderId)`.
- Consumes: supplied `event_id`, `order_id`, `status`, `amount`, `currency`, `created_at` contract.

- [ ] **Step 1: Write failing duplicate and early-event tests**

```js
test("stores an early paid webhook and applies it once after order creation", async () => {
  await payments.acceptPaymentEvent(fixtures.paidEvent({ orderId: "external-early" }));
  const order = await orders.createOrder({ clientRequestId: "external-early", sku: "KEY-CS2-PRIME" });
  expect((await orders.getOrder(order.id)).status).toBe("delivered");
  expect(await repository.countFulfillments(order.id)).toBe(1);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/payment-webhooks.test.mjs`

Expected: FAIL because early events are not stored.

- [ ] **Step 3: Implement durable event ingestion**

Insert every valid event first. Duplicate `event_id` returns the current state. If an order exists, lock and process it; otherwise leave `processed_at` null. Order creation invokes pending processing after commit through the same idempotent service.

- [ ] **Step 4: Verify all payment scenarios**

Run: `pnpm vitest run tests/integration/payment-webhooks.test.mjs tests/integration/fulfillment-race.test.mjs`

Expected: duplicate, failed, early, out-of-order, and 50-parallel cases pass.

- [ ] **Step 5: Commit**

```bash
git add server/domain/payment-service.mjs server/db/payment-repository.mjs tests/integration
git commit -m "feat: process payment webhooks idempotently"
```

### Task 6: Supplier A/B stubs, timeout ambiguity, and admin recovery

**Files:**
- Create: `server/domain/supplier-service.mjs`, `server/domain/recovery-service.mjs`
- Create: `server/db/supplier-repository.mjs`, `server/db/admin-repository.mjs`
- Test: `tests/integration/suppliers.test.mjs`, `tests/integration/recovery.test.mjs`

**Interfaces:**
- Produces: `issueFromSupplier({ provider, requestId, sku, orderId })`, `retryOrder(orderId)`, `refillInventory(input)`, and `listRecoverableOrders()`.
- Guarantees: `(provider, requestId)` always resolves to the persisted code; timeout is not failure; delivered retries are no-ops.

- [ ] **Step 1: Write the failing timeout-replay test**

```js
test("repeating a timed-out supplier request returns the same persisted code", async () => {
  const request = { provider: "A", requestId: "req_stable", sku: "STEAM-TOPUP-500", orderId: "ord_stable" };
  await expect(suppliers.issueFromSupplier({ ...request, behavior: "timeout_after_issue" })).rejects.toMatchObject({ code: "SUPPLIER_TIMEOUT" });
  const replay = await suppliers.issueFromSupplier(request);
  expect(replay).toMatchObject({ status: "ok", request_id: "req_stable" });
  expect(await repository.distinctCodesForRequest("A", "req_stable")).toBe(1);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/suppliers.test.mjs tests/integration/recovery.test.mjs`

Expected: FAIL because supplier persistence and recovery do not exist.

- [ ] **Step 3: Implement stubs and recovery**

Persist the deterministic stub result before simulating a timeout. Retry ambiguous timeout with the same provider/request ID. Permit fallback B only after explicit A failure. Admin refill inserts unique keys; retry locks recoverable orders and calls the normal fulfillment path.

- [ ] **Step 4: Verify recovery idempotency**

Run: `pnpm vitest run tests/integration/suppliers.test.mjs tests/integration/recovery.test.mjs --repeat=3`

Expected: empty pool → refill → concurrent retries yields exactly one key and one fulfillment.

- [ ] **Step 5: Commit**

```bash
git add server/domain server/db tests/integration
git commit -m "feat: add resilient suppliers and admin recovery"
```

### Task 7: REST router and Netlify Function adapter

**Files:**
- Create: `server/router.mjs`, `server/http/request.mjs`, `server/http/response.mjs`, `server/http/admin-auth.mjs`
- Create: `netlify/functions/api.mjs`
- Test: `tests/unit/router.test.mjs`, `tests/integration/api.test.mjs`

**Interfaces:**
- Produces: endpoints listed in the design spec and `createRouter(dependencies)`.

- [ ] **Step 1: Write the failing endpoint-contract test**

```js
test("POST /api/orders returns a server-priced order", async () => {
  const response = await request("POST", "/api/orders", { client_request_id: crypto.randomUUID(), sku: "KEY-CS2-PRIME" });
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ sku: "KEY-CS2-PRIME", total: 129000, currency: "RUB", status: "created" });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/unit/router.test.mjs tests/integration/api.test.mjs`

Expected: FAIL with route not found.

- [ ] **Step 3: Implement validation, routes, and adapter**

Map thrown domain codes to explicit 400/404/409/503 responses, return 202 for a durable early webhook, require `Authorization: Bearer <ADMIN_TOKEN>` for admin routes, and keep unexpected database errors retryable as 500.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run tests/unit/router.test.mjs tests/integration/api.test.mjs && pnpm build`

Expected: all contracts pass and Netlify bundles the function.

- [ ] **Step 5: Commit**

```bash
git add server/router.mjs server/http netlify tests
git commit -m "feat: expose GameDrop REST API on Netlify"
```

### Task 8: High-fidelity storefront and purchase experience

**Files:**
- Create: `index.html`, `src/main.js`, `src/api/client.js`
- Create: `src/ui/carousel.js`, `src/ui/catalog-menu.js`, `src/ui/currency-switcher.js`, `src/ui/checkout.js`, `src/ui/order-status.js`, `src/ui/admin.js`
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/storefront.css`, `src/styles/components.css`, `src/styles/responsive.css`
- Create: `public/assets/*`
- Test: `tests/unit/ui-state.test.mjs`, `tests/e2e/storefront.spec.mjs`, `tests/e2e/purchase.spec.mjs`

**Interfaces:**
- Produces: the supplied two visual states, all five assessed interactions, and a complete purchase/status/admin flow.

- [ ] **Step 1: Copy and optimize the supplied Figma assets**

Use the extracted source images, preserve aspect ratio, give every content image meaningful alt text, and keep decorative images empty-alt. Do not substitute unrelated stock art.

- [ ] **Step 2: Write failing browser tests for the five interactions**

```js
test("catalog closes on a second click and on an outside click", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Каталог" }).click();
  await expect(page.getByRole("dialog", { name: "Каталог товаров" })).toBeVisible();
  await page.getByRole("button", { name: "Каталог" }).click();
  await expect(page.getByRole("dialog", { name: "Каталог товаров" })).toBeHidden();
});
```

Use explicit assertions for the remaining interactions:

```js
await page.getByRole("button", { name: "Следующий баннер" }).click();
await expect(page.locator("[data-slide='1']")).toHaveAttribute("aria-hidden", "false");
await page.getByRole("button", { name: "Доллары" }).click();
await expect(page.getByRole("button", { name: "Доллары" })).toHaveAttribute("aria-pressed", "true");
await page.locator("[data-service='steam']").hover();
await expect(page.locator("[data-service='steam']")).toHaveClass(/is-hovered/);
await page.locator("[data-product='KEY-CS2-PRIME']").hover();
await expect(page.locator("[data-product='KEY-CS2-PRIME']")).toHaveClass(/is-hovered/);
```

- [ ] **Step 3: Verify RED**

Run: `pnpm playwright test tests/e2e/storefront.spec.mjs`

Expected: FAIL because the page and controls do not exist.

- [ ] **Step 4: Implement the storefront from the parsed Figma values**

Use Montserrat, the 1920/1200 px composition, the supplied gray/white/black palette, 18 px card radii, subtle shadows, and the exact section hierarchy. Add responsive reflow as progressive enhancement. Use visible focus styles and keyboard-operable controls.

- [ ] **Step 5: Implement and test purchase/status/admin flows**

Run: `pnpm playwright test tests/e2e/storefront.spec.mjs tests/e2e/purchase.spec.mjs`

Expected: all interactions and a delivered-key flow pass.

- [ ] **Step 6: Commit**

```bash
git add index.html public src tests/e2e tests/unit/ui-state.test.mjs
git commit -m "feat: build the GameDrop storefront experience"
```

### Task 9: Acceptance race scripts and continuous integration

**Files:**
- Create: `scripts/race-webhooks.mjs`, `scripts/race-promocodes.mjs`, `scripts/verify-acceptance.mjs`
- Create: `.github/workflows/ci.yml`
- Test: `tests/integration/acceptance.test.mjs`

**Interfaces:**
- Produces: one command that proves all five acceptance criteria against a running deployment or local Netlify Dev server.

- [ ] **Step 1: Write the failing acceptance aggregate**

```js
const report = await runAcceptance({ baseUrl, databaseUrl });
expect(report).toMatchObject({
  parallelWebhooks: { fulfillmentFacts: 1, consumedKeys: 1 },
  duplicateEvent: { changedRows: 0 },
  earlyWebhook: { deliveredKeys: 1 },
  recovery: { deliveredKeys: 1 },
  promo: { redemptions: 3, maxUses: 3 },
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/acceptance.test.mjs`

Expected: FAIL because the race scripts do not exist.

- [ ] **Step 3: Implement scripts and CI PostgreSQL service**

The webhook script creates one order and key, sends 50 `paid` events in parallel, queries public status plus database invariants, and exits nonzero on mismatch. CI runs migration, seed, unit/integration tests, production build, and Playwright.

- [ ] **Step 4: Verify GREEN repeatedly**

Run: `pnpm test && pnpm run verify:acceptance`

Expected: all five scenarios pass on three consecutive runs.

- [ ] **Step 5: Commit**

```bash
git add scripts tests/integration/acceptance.test.mjs .github/workflows/ci.yml package.json
git commit -m "test: automate GameDrop acceptance races"
```

### Task 10: Documentation, MIT license, GitHub, and Netlify deployment

**Files:**
- Create: `README.md`, `LICENSE`
- Modify: `.env.example`, `netlify.toml`, `package.json`

**Interfaces:**
- Produces: public GitHub source and a working free Netlify URL.

- [ ] **Step 1: Write README against the verified commands**

Document architecture, setup, environment variables, migrations, local start, Netlify deploy, API examples, admin token use, every race command, exactly-once explanation, recovery semantics, Figma/source attribution, and actual time spent. Do not claim a command works until it was run.

- [ ] **Step 2: Add the canonical MIT license**

Use copyright `2026 DokPlay` and the unmodified MIT grant/disclaimer text.

- [ ] **Step 3: Run the complete release gate**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build && pnpm run verify:acceptance`

Expected: clean output, all tests pass, production artifacts generated.

- [ ] **Step 4: Push the repository and deploy**

Set `origin` to `https://github.com/DokPlay/GameDrop.git`, rename the branch to `main`, push, connect the existing Netlify site, provision the free database, set `DATABASE_URL` and `ADMIN_TOKEN`, deploy, and run smoke plus acceptance checks against the live URL.

- [ ] **Step 5: Final commit**

```bash
git add README.md LICENSE .env.example netlify.toml package.json
git commit -m "docs: complete GameDrop delivery guide"
```

---

## Self-review

- Spec coverage: tasks 3–6 cover every mandatory and bonus backend behavior; task 8 covers the supplied design and five interactions; task 9 maps one-to-one to all five acceptance criteria; task 10 covers every requested deliverable.
- Placeholder scan: the plan contains no deferred implementation placeholders; each task names concrete files, commands, APIs, assertions, and expected outcomes.
- Type/name consistency: `createOrder`, `acceptPaymentEvent`, `fulfillPaidOrder`, `issueFromSupplier`, `retryOrder`, and `runAcceptance` retain the same names across producers and consumers.
