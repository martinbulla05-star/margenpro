-- MargenPro commercial data model (Cloudflare D1 / SQLite).
-- Not deployed. All writes must be made by authenticated backend code.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  identity_provider TEXT NOT NULL,
  identity_subject TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(identity_provider, identity_subject)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  provider TEXT NOT NULL CHECK (provider = 'mercadopago'),
  provider_reference TEXT UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','pending','approved','rejected','refunded','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_provider_reference ON orders(provider_reference);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL CHECK (provider = 'mercadopago'),
  provider_payment_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','refunded')),
  verified_at TEXT NOT NULL,
  UNIQUE(provider, provider_payment_id)
);

-- An approved order must have a matching verified approved payment record.
-- The backend alone is responsible for writing payments after provider API verification.
CREATE TRIGGER IF NOT EXISTS trg_order_approval_requires_payment
BEFORE UPDATE OF status ON orders
WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
 AND NOT EXISTS (
   SELECT 1 FROM payments p WHERE p.order_id = NEW.id
     AND p.provider = NEW.provider AND p.status = 'approved'
     AND p.amount_minor = NEW.amount_minor AND p.currency = NEW.currency
 )
BEGIN
 SELECT RAISE(ABORT, 'approved_order_requires_verified_payment_record');
END;

CREATE TRIGGER IF NOT EXISTS trg_order_insert_approval_requires_payment
BEFORE INSERT ON orders
WHEN NEW.status = 'approved'
BEGIN
 SELECT RAISE(ABORT, 'approved_order_must_start_unapproved');
END;

-- Reject mismatched or fabricated-value payment records at the database boundary.
CREATE TRIGGER IF NOT EXISTS trg_payment_order_amount_guard
BEFORE INSERT ON payments
WHEN NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.id = NEW.order_id
    AND o.provider = NEW.provider
    AND o.amount_minor = NEW.amount_minor AND o.currency = NEW.currency
)
BEGIN
 SELECT RAISE(ABORT, 'payment_order_amount_mismatch');
END;

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  status TEXT NOT NULL CHECK (status IN ('active','revoked','expired')),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT,
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);

-- Licenses may be activated only for an approved order owned by the same user
-- and for the same commercial product.
CREATE TRIGGER IF NOT EXISTS trg_entitlement_insert_guard
BEFORE INSERT ON entitlements
WHEN NEW.status = 'active' AND NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.id = NEW.order_id
    AND o.user_id = NEW.user_id AND o.product_id = NEW.product_id
    AND o.status = 'approved'
)
BEGIN
  SELECT RAISE(ABORT, 'active_license_requires_approved_matching_order');
END;

CREATE TRIGGER IF NOT EXISTS trg_entitlement_update_guard
BEFORE UPDATE OF status, user_id, product_id, order_id ON entitlements
WHEN NEW.status = 'active' AND NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.id = NEW.order_id
    AND o.user_id = NEW.user_id AND o.product_id = NEW.product_id
    AND o.status = 'approved'
)
BEGIN
  SELECT RAISE(ABORT, 'active_license_requires_approved_matching_order');
END;

-- A refunded or cancelled order must not leave an active license behind.
CREATE TRIGGER IF NOT EXISTS trg_order_revoke_license
AFTER UPDATE OF status ON orders
WHEN NEW.status <> 'approved'
BEGIN
  UPDATE entitlements SET status='revoked', revoked_at=datetime('now')
  WHERE order_id=NEW.id AND status='active';
END;

-- Prevent order reassignment after any entitlement has been issued.
CREATE TRIGGER IF NOT EXISTS trg_order_immutable_license_owner
BEFORE UPDATE OF user_id, product_id ON orders
WHEN EXISTS (SELECT 1 FROM entitlements e WHERE e.order_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'licensed_order_owner_product_immutable');
END;

CREATE INDEX IF NOT EXISTS idx_entitlements_user_product ON entitlements(user_id, product_id, status);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'mercadopago'),
  provider_event_id TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE(provider, provider_event_id)
);
