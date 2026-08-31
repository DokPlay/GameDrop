CREATE TABLE products (
  id uuid PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  fulfillment_mode text NOT NULL DEFAULT 'pool'
    CHECK (fulfillment_mode IN ('pool', 'supplier')),
  image_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE promos (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code = upper(code)),
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_uses integer NOT NULL CHECK (max_uses >= 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL UNIQUE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  promo_id uuid REFERENCES promos(id) ON DELETE SET NULL,
  sku text NOT NULL,
  product_name text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created', 'paid', 'delivering', 'delivered', 'payment_failed',
      'out_of_stock', 'delivery_failed'
    )
  ),
  subtotal_minor integer NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor integer NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  total_minor integer NOT NULL CHECK (total_minor >= 0),
  currency text NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  issued_code text,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  delivered_at timestamptz,
  CHECK (discount_minor <= subtotal_minor),
  CHECK (total_minor = subtotal_minor - discount_minor),
  CHECK ((status = 'delivered' AND issued_code IS NOT NULL) OR status <> 'delivered')
);

CREATE INDEX orders_status_created_at_idx ON orders (status, created_at);

CREATE TABLE promo_redemptions (
  id uuid PRIMARY KEY,
  promo_id uuid NOT NULL REFERENCES promos(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  discount_minor integer NOT NULL CHECK (discount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_id, order_id)
);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  external_order_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('paid', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);

CREATE INDEX payment_events_external_order_idx
  ON payment_events (external_order_id, received_at);

CREATE TABLE pending_payment_events (
  id uuid PRIMARY KEY,
  payment_event_id uuid NOT NULL UNIQUE REFERENCES payment_events(id) ON DELETE RESTRICT,
  external_order_id uuid NOT NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pending_payment_events_due_idx
  ON pending_payment_events (next_attempt_at, external_order_id);

CREATE TABLE inventory_keys (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  assigned_order_id uuid UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz,
  CHECK (
    (assigned_order_id IS NULL AND assigned_at IS NULL)
    OR (assigned_order_id IS NOT NULL AND assigned_at IS NOT NULL)
  )
);

CREATE INDEX inventory_keys_available_idx
  ON inventory_keys (product_id, created_at)
  WHERE assigned_order_id IS NULL;

CREATE TABLE fulfillment_records (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  inventory_key_id uuid UNIQUE REFERENCES inventory_keys(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('pool', 'supplier')),
  provider text CHECK (provider IN ('A', 'B')),
  request_id text,
  status text NOT NULL CHECK (status IN ('delivering', 'delivered', 'out_of_stock', 'failed', 'timeout')),
  issued_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (provider, request_id),
  CHECK ((source = 'pool' AND provider IS NULL) OR source = 'supplier'),
  CHECK ((status = 'delivered' AND issued_code IS NOT NULL) OR status <> 'delivered')
);

CREATE TABLE fulfillment_attempts (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  fulfillment_id uuid REFERENCES fulfillment_records(id) ON DELETE SET NULL,
  provider text CHECK (provider IN ('A', 'B')),
  request_id text,
  outcome text NOT NULL CHECK (outcome IN ('started', 'delivered', 'out_of_stock', 'failed', 'timeout')),
  error_code text,
  error_detail text,
  ambiguous boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX fulfillment_attempts_order_idx
  ON fulfillment_attempts (order_id, started_at DESC);

CREATE TABLE supplier_requests (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('A', 'B')),
  request_id text NOT NULL,
  sku text NOT NULL,
  external_order_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('issued', 'failed')),
  response_code text,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, request_id),
  CHECK ((status = 'issued' AND response_code IS NOT NULL) OR status <> 'issued')
);

CREATE OR REPLACE FUNCTION prevent_inventory_reassignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.assigned_order_id IS NOT NULL
     AND NEW.assigned_order_id IS DISTINCT FROM OLD.assigned_order_id THEN
    RAISE EXCEPTION 'inventory key assignment is immutable'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_assignment_is_immutable
BEFORE UPDATE OF assigned_order_id ON inventory_keys
FOR EACH ROW
EXECUTE FUNCTION prevent_inventory_reassignment();
