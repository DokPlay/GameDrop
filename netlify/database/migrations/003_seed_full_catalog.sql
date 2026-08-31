INSERT INTO products (
  id, sku, name, description, price_minor, currency, fulfillment_mode, active
) VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'KEY-CS2-PRIME',
    'Counter-Strike 2 — Prime Status',
    'Цифровой ключ активации Prime Status для Steam.',
    129000,
    'RUB',
    'pool',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'STEAM-TOPUP-500',
    'Пополнение Steam — 500 ₽',
    'Тестовый товар с выдачей через поставщиков A/B.',
    55000,
    'RUB',
    'supplier',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'WILDCAT-GUN',
    'Wildcat Gun Machine',
    'Цифровой ключ Wildcat Gun Machine с автоматической выдачей.',
    99000,
    'RUB',
    'pool',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'ROGUE-COMPANY',
    'Rogue Company — Epic Games',
    'Цифровой ключ Rogue Company для Epic Games.',
    59900,
    'RUB',
    'pool',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'ZOMBIE-ARMY-4',
    'Zombie Army 4: Dead War',
    'Цифровой ключ Zombie Army 4: Dead War для Steam.',
    149000,
    'RUB',
    'pool',
    true
  )
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_minor = EXCLUDED.price_minor,
  currency = EXCLUDED.currency,
  fulfillment_mode = EXCLUDED.fulfillment_mode,
  active = true,
  updated_at = now();

INSERT INTO promos (
  id, code, discount_type, discount_value, max_uses, used_count, active
) VALUES (
  '00000000-0000-4000-8000-000000000010',
  'WELCOME10',
  'percent',
  10,
  100,
  0,
  true
)
ON CONFLICT (code) DO UPDATE SET active = true;

INSERT INTO inventory_keys (id, product_id, code)
SELECT
  ('00000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  products.id,
  'CS2-PRIME-DEMO-' || lpad(series::text, 4, '0')
FROM products
CROSS JOIN generate_series(101, 112) AS series
WHERE products.sku = 'KEY-CS2-PRIME'
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_keys (id, product_id, code)
SELECT
  ('10000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  products.id,
  'WILDCAT-DEMO-' || lpad(series::text, 4, '0')
FROM products
CROSS JOIN generate_series(201, 212) AS series
WHERE products.sku = 'WILDCAT-GUN'
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_keys (id, product_id, code)
SELECT
  ('20000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  products.id,
  'ROGUE-DEMO-' || lpad(series::text, 4, '0')
FROM products
CROSS JOIN generate_series(301, 312) AS series
WHERE products.sku = 'ROGUE-COMPANY'
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_keys (id, product_id, code)
SELECT
  ('30000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  products.id,
  'ZOMBIE4-DEMO-' || lpad(series::text, 4, '0')
FROM products
CROSS JOIN generate_series(401, 412) AS series
WHERE products.sku = 'ZOMBIE-ARMY-4'
ON CONFLICT (code) DO NOTHING;
