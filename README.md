# GameDrop

Полноценный тестовый прототип маркетплейса цифровых товаров: витрина по исходному Figma-макету, REST API, заглушка оплаты, автоматическая выдача ключей и доказанная конкурентная безопасность.

Демо: [gamedrop-dokplay.netlify.app](https://gamedrop-dokplay.netlify.app)

![GameDrop storefront](docs/assets/storefront-preview.png)

## Что реализовано

- адаптивная витрина на чистых HTML, CSS и JavaScript без React/Vue/Next;
- оригинальные изображения из предоставленного `Untitled (2).fig`;
- карусель, интерактивное мегаменю, поиск, фильтры, избранное, корзина и переключатель валют;
- отдельный блок пополнения Steam по исходному макету с промокодом и выбором валюты;
- живой checkout: создание заказа → тестовая оплата → статус → выданный ключ;
- REST API в Netlify Function;
- PostgreSQL-схема с транзакциями, блокировками и ограничениями уникальности;
- exactly-once выдача: один заказ получает не более одного ключа, один ключ не попадает в два заказа;
- идемпотентные `event_id`, 50 параллельных webhooks и ранний webhook до появления заказа;
- восстановимое `out_of_stock` / `delivery_failed`, список проблемных заказов, refill и безопасный admin retry;
- поставщики A/B: детерминированный ответ `(provider, request_id)`, сохранение результата до таймаута, fallback только после явного 5xx;
- промокоды с серверным расчётом скидки и атомарным лимитом использований;
- пять товаров витрины синхронизированы с PostgreSQL; для каждого pool‑товара загружено по 12 демо‑ключей;
- unit, PostgreSQL integration, browser E2E, acceptance race scripts и GitHub Actions.

## Стек

- Frontend: HTML5, CSS3, JavaScript ES modules, Vite, Montserrat и Lucide icons.
- Backend: Node.js 22, Netlify Functions, framework-free REST router.
- Data: PostgreSQL 16, `pg`, SQL migrations.
- QA: Vitest, Playwright, ESLint, GitHub Actions.

Такой стек соответствует ТЗ: тяжёлый frontend-фреймворк не используется, backend реализован на Node.js, хранение — PostgreSQL.

## Архитектура

```mermaid
flowchart LR
  UI[Storefront] -->|REST /api| NF[Netlify Function]
  NF --> Router[HTTP router]
  Router --> Orders[Order service]
  Router --> Payments[Payment service]
  Router --> Recovery[Recovery service]
  Payments --> Fulfillment[Fulfillment service]
  Recovery --> Fulfillment
  Fulfillment --> Pool[Key pool]
  Fulfillment --> Suppliers[Supplier A / B]
  Orders --> DB[(PostgreSQL)]
  Payments --> DB
  Fulfillment --> DB
  Suppliers --> DB
```

Критические гарантии находятся не только в JavaScript:

- `payment_events.event_id` — `UNIQUE`;
- `orders.client_request_id` — `UNIQUE`;
- `fulfillment_records.order_id` — `UNIQUE`;
- `fulfillment_records.inventory_key_id` — `UNIQUE`;
- `inventory_keys.assigned_order_id` — nullable `UNIQUE` и неизменяем после назначения;
- `(supplier_requests.provider, supplier_requests.request_id)` — `UNIQUE`;
- выдача блокирует заказ через `FOR UPDATE`, свободный ключ берётся через `FOR UPDATE SKIP LOCKED`;
- лимит промокода резервируется условным `UPDATE ... WHERE used_count < max_uses` в транзакции заказа.

## Быстрый старт

Требуются Node.js 22+, pnpm 11+ и PostgreSQL 16+.

```bash
pnpm install
copy .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Для PowerShell:

```powershell
Copy-Item .env.example .env
```

Основные переменные:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/gamedrop
DATABASE_SSL=true
ADMIN_TOKEN=replace-with-a-long-random-value
PUBLIC_SITE_URL=http://localhost:8888
```

Секреты не должны попадать в Git. `.env` уже исключён.

### Windows и Netlify Dev

pnpm использует symlink. Если `netlify dev` завершается с `EPERM ... symlink`, включите Windows Developer Mode или запустите терминал с правом создания символических ссылок. Это ограничение локальной Windows-среды; `netlify build` и Linux-сборка Netlify работают без него.

## API

Все суммы — целые минорные единицы RUB: `129000` означает `1 290 ₽`.

### Создать заказ

```http
POST /api/orders
Content-Type: application/json

{
  "client_request_id": "2cb77068-42f1-4cb5-9df2-b6775c718bae",
  "sku": "KEY-CS2-PRIME",
  "promo_code": "WELCOME10"
}
```

Переданные клиентом `price`, `discount` и `total` игнорируются. Цена и скидка считаются на сервере.

### Получить статус

```http
GET /api/orders/:orderId
```

Возможные состояния: `created`, `paid`, `delivering`, `delivered`, `payment_failed`, `out_of_stock`, `delivery_failed`. Код возвращается только для `delivered`.

### Тестовая оплата

```http
POST /api/orders/:orderId/pay
Content-Type: application/json

{}
```

### Webhook оплаты

```http
POST /api/payments/webhook
Content-Type: application/json

{
  "event_id": "evt_unique_001",
  "order_id": "2cb77068-42f1-4cb5-9df2-b6775c718bae",
  "status": "paid",
  "amount": 129000,
  "currency": "RUB",
  "created_at": "2026-08-31T12:00:00.000Z"
}
```

Раннее событие получает `202` и сохраняется до появления заказа. Повтор `event_id` не меняет выдачу.

### Поставщики A/B

```http
POST /api/suppliers/A/issue
Content-Type: application/json

{
  "request_id": "fulfill_order_001",
  "order_id": "order_001",
  "sku": "STEAM-TOPUP-500",
  "behavior": "timeout_after_issue"
}
```

Тестовые `behavior`: `timeout_after_issue`, `fail_5xx`; без поля — успешный ответ. При повторе одной пары `(provider, request_id)` возвращается сохранённый результат.

### Admin recovery

```http
Authorization: Bearer <ADMIN_TOKEN>

GET  /api/admin/orders
POST /api/admin/orders/:orderId/retry
POST /api/admin/inventory/refill
```

Refill body:

```json
{ "sku": "KEY-CS2-PRIME", "codes": ["NEW-KEY-001", "NEW-KEY-002"] }
```

Retry доставленного заказа — no-op и не расходует второй ключ.

## Проверки

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm lint
pnpm build
```

Полный acceptance-отчёт:

```bash
pnpm verify:acceptance
```

Отдельные гонки:

```bash
pnpm race:webhooks
pnpm race:promos
```

Runner намеренно отказывается выполнять `TRUNCATE`, если имя текущей базы не содержит `test`.

Проверенный результат:

```json
{
  "parallelWebhooks": { "fulfillmentFacts": 1, "consumedKeys": 1, "status": "delivered" },
  "duplicateEvent": { "eventRows": 1, "fulfillmentFacts": 1, "consumedKeys": 1 },
  "earlyWebhook": { "fulfillmentFacts": 1, "deliveredKeys": 1, "status": "delivered" },
  "recovery": { "fulfillmentFacts": 1, "deliveredKeys": 1, "status": "delivered" },
  "promo": { "redemptions": 3, "maxUses": 3, "fulfilledOrders": 3 }
}
```

## Бесплатный deploy на Netlify

1. Подключите GitHub-репозиторий в Netlify.
2. На странице проекта откройте **Database** и выберите ручное создание Netlify Database.
3. Схема и демонстрационные данные из `netlify/database/migrations` применятся автоматически перед публикацией production deploy.
4. Runtime получает безопасное подключение через `@netlify/database`; локальные тесты и CI по-прежнему используют `DATABASE_URL`.
5. Для admin recovery добавьте случайный `ADMIN_TOKEN` в переменные окружения проекта.
6. Build command и publish directory уже заданы в `netlify.toml`: `pnpm build`, `dist`.

Сайт получает бесплатный адрес `*.netlify.app`; собственный домен не требуется. Netlify Database работает в пределах бесплатных кредитов аккаунта и засыпает после пяти минут бездействия.

## Макет

- Локальный источник: `Untitled (2).fig`, 1920×2494 и состояние открытого каталога 1920×1047.
- Рабочая копия Figma: [GameDrop — макет из технического задания](https://www.figma.com/design/G5r9F51TrT2P0EuiTEHdsK).
- Использованы оригинальные растровые assets из файла; случайные stock-изображения не добавлялись.

Figma Starter ограничил количество plugin-вызовов после импорта assets и первых слоёв, поэтому сайт построен по полностью локально распарсенному `.fig`. Это ограничение облачного тарифа не влияет на исходники и deploy.

## Границы прототипа

- реального эквайринга и реальных списаний нет;
- Steam OAuth не реализован;
- admin-защита — простой bearer token по условиям тестового задания;
- production-проекту дополнительно нужны rate limiting, полноценная аутентификация, управление секретами и мониторинг.

Фактическое время реализации в рамках рабочей сессии: около 3 часов. Лицензия — MIT.
