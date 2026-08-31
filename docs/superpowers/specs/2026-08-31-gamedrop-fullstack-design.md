# GameDrop Fullstack Prototype Design

## Purpose

Build the complete test assignment as a convincing, publicly accessible prototype of a digital-goods storefront. The result must stay within the assignment's technology boundaries, implement mandatory stages 1–2 and bonus stages 3–4, and make every concurrency acceptance scenario reproducible.

## Source authority

- The assignment document is authoritative for scope and behavior.
- The supplied `Untitled (2).fig` is authoritative for storefront structure, content, assets, typography, and the two catalog states.
- Pixel-perfect reproduction is not required, but the structure and five required interactions must be visibly close to the supplied design.
- Real acquiring, Steam authentication, a polished admin design, dark mode, and a full mobile design are explicitly outside the required scope.

## Technology decision

The assignment explicitly allows HTML/CSS/JavaScript on the frontend, Node.js or PHP (or another stack) for a REST API, and any database or file storage. The implementation therefore uses:

- Frontend: semantic HTML, modular CSS, and browser-native JavaScript ES modules. No React, Next.js, Vue, or other heavy UI framework.
- Build tooling: Vite only for development, asset handling, and production bundling.
- Backend: Node.js ES modules running as Netlify Functions behind `/api/*`.
- Storage: PostgreSQL through `pg`, because row locks, unique constraints, and atomic conditional updates are required to prove the race guarantees.
- Tests: Vitest for unit tests, PostgreSQL integration tests for transactional behavior, Playwright for the five required interactions, and a standalone 50-request race script.
- Hosting: Netlify Free with the generated `netlify.app` domain; GitHub is the source repository.

TypeScript is deliberately not required in production code: plain JavaScript follows the assignment literally and avoids presenting a compiled language as an unnecessary deviation.

## User-facing surfaces

### Storefront

The storefront recreates the supplied 1920 px desktop composition and adds sensible responsive behavior:

- Header with catalog button, search, favorites, and profile affordance.
- Banner carousel with automatic rotation, arrow controls, and active indicators.
- Service icon rail with hover emphasis.
- Steam top-up panel with an untouched login placeholder and a clickable currency-state selector. Currency selection is display-only, as required.
- Product sections, reviews, and footer from the supplied design for visual completeness.
- Working purchase flow for `KEY-CS2-PRIME`: product card → order panel → simulated payment → order status and delivered key.
- Promo input appears only in stage-4-capable checkout.

The five explicitly assessed interactions are carousel controls, catalog open/close/outside click, currency active state, service-icon hover, and product-card hover.

### Order status

The order status view exposes `created`, `paid`, `delivering`, `delivered`, `payment_failed`, `out_of_stock`, and `delivery_failed`. It shows the key only in the delivered state and explains recoverable states without leaking admin controls.

### Admin recovery

The admin surface uses a simple `ADMIN_TOKEN`, which the assignment permits. It lists paid but undelivered orders, displays attempts and last error, supports inventory refill, and offers a safe manual retry. A retry of a delivered order is a no-op and never consumes another key.

## API

All endpoints return JSON and use server-calculated totals.

- `GET /api/catalog`
- `POST /api/orders` with `client_request_id`, `sku`, and optional `promo_code`
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/pay` to invoke the payment-webhook stub
- `POST /api/webhooks/payment` using the supplied webhook contract
- `POST /api/suppliers/:provider/issue` using the supplied supplier contract
- `GET /api/admin/orders?status=out_of_stock,delivery_failed`
- `POST /api/admin/orders/:orderId/retry`
- `POST /api/admin/inventory/refill`

Webhook responses acknowledge a durable event with a 2xx response. Invalid payloads receive 4xx; transient database failures receive 5xx so delivery can be retried.

## Data model and invariants

### Tables

- `products`: SKU, price in minor RUB units, display metadata, and fulfillment mode (`pool` or `supplier`).
- `orders`: UUID, unique `client_request_id`, SKU snapshot, subtotal, discount, total, currency, status, issued code, and timestamps.
- `payment_events`: unique `event_id`, external `order_id`, payload, received timestamp, and processed timestamp. It may exist before its order.
- `inventory_keys`: unique code, SKU, and nullable unique `assigned_order_id`.
- `fulfillment_records`: unique `order_id`, request ID, provider, result, and issued code.
- `fulfillment_attempts`: append-only attempt history, including timeouts and explicit failures.
- `supplier_requests`: unique `(provider, request_id)` with a persisted deterministic response, making supplier stubs idempotent.
- `promocodes`: code, discount type/value, `max_uses`, `used_count`, and active window.
- `promo_redemptions`: unique `(promo_id, order_id)` and unique `order_id`.

### Exactly-once fulfillment

Payment processing runs in a PostgreSQL transaction:

1. Insert `payment_events` with `ON CONFLICT (event_id) DO NOTHING`.
2. If the event already exists, return the current order state without changing inventory.
3. Lock the order with `SELECT ... FOR UPDATE`.
4. Apply a legal monotonic status transition only.
5. Insert `fulfillment_records` under a unique `order_id`.
6. For pool products, claim one unassigned key with `FOR UPDATE SKIP LOCKED`, then conditionally set `assigned_order_id`.
7. Write the delivered code and final status in the same transaction.

The unique constraints are the final safety net; the transaction and row lock make the behavior deterministic under concurrent requests.

### Out-of-order webhook

An early webhook is inserted durably even if the order does not exist. Order creation checks unprocessed events for its external order ID in the same transaction and immediately processes them. No event is dropped, and duplicate event IDs remain no-ops.

### Recoverable failures

An empty pool changes the order from `delivering` to `out_of_stock` without throwing away payment state. After inventory refill, admin retry locks the same order and re-enters fulfillment. The unique fulfillment/order and key-assignment constraints ensure exactly one final code.

Supplier products use stubs A and B. Each stub persists the response for `(provider, request_id)` before returning or simulating a timeout. A retry after a timeout first repeats the same provider and request ID; timeout is ambiguous and never treated as a clean failure. An explicit 5xx may use the fallback provider. The same request ID always returns the same code from a provider.

### Promo concurrency

Promo validation and redemption occur inside order creation. A conditional update increments `used_count` only where `used_count < max_uses`; the redemption row and order are committed together. Repeating a `client_request_id` returns the existing order and cannot consume the limit twice. The server ignores client-supplied price or discount values.

## Verification

Automated checks must cover:

1. Fifty parallel paid webhooks for one order produce one fulfillment record and consume one key.
2. Reusing the same `event_id` produces no changes.
3. A webhook arriving before order creation is later applied once.
4. Empty inventory creates `out_of_stock`; refill plus repeated retry yields one key.
5. More than N parallel promo orders produce at most N redemptions.
6. Supplier request IDs return stable codes, timeouts remain ambiguous, and explicit failures may fall back.
7. All five storefront interactions work in a real browser.

The repository includes `scripts/race-webhooks.mjs` and `scripts/race-promocodes.mjs`, with exact commands and expected invariants in README.

## Delivery

- GitHub repository: `DokPlay/GameDrop`.
- MIT License.
- README with setup, environment variables, migrations, local run, deployment, race reproduction, architecture explanation, and actual time spent.
- GitHub Actions uses a PostgreSQL service and runs lint, unit/integration tests, production build, and browser tests.
- Netlify deploy uses the free generated domain; no custom domain or paid service is required.

