-- Hublo.be v0.1 — schéma initial complet
-- Voir CLAUDE.md pour les règles métier, l'ordre des statuts et le raisonnement RLS.

-- ============================================================================
-- Helper : updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- users & settings
-- ============================================================================

CREATE TABLE users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text UNIQUE NOT NULL,
  first_name text,
  last_name  text,
  phone      text,
  role       text NOT NULL CHECK (role IN ('admin', 'client')),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ============================================================================
-- Helper : is_admin() — SECURITY DEFINER pour bypass RLS récursive
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- ============================================================================
-- producers & collection_points
-- ============================================================================

CREATE TABLE producers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  vat_number  text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX producers_status_idx ON producers(status);

CREATE TRIGGER producers_updated_at BEFORE UPDATE ON producers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE collection_points (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  slug                        text UNIQUE NOT NULL,
  address                     text NOT NULL,
  schedule                    jsonb,
  coordinator_user_id         uuid REFERENCES users(id),
  coordinator_commission_bps  int NOT NULL DEFAULT 0 CHECK (coordinator_commission_bps >= 0),
  status                      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX collection_points_status_idx ON collection_points(status);

CREATE TRIGGER collection_points_updated_at BEFORE UPDATE ON collection_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- products
-- ============================================================================

CREATE TABLE products (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id          uuid NOT NULL REFERENCES producers(id),
  collection_point_id  uuid REFERENCES collection_points(id),
  name                 text NOT NULL,
  slug                 text UNIQUE NOT NULL,
  description          text NOT NULL,
  photo_url            text,
  photo_alt            text,
  price_ht_cents       int NOT NULL CHECK (price_ht_cents BETWEEN 10 AND 999900),
  vat_rate             int NOT NULL CHECK (vat_rate IN (0, 6, 21)),
  stock_unlimited      boolean NOT NULL DEFAULT true,
  stock_qty            int,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_coherence CHECK (
    (stock_unlimited = true  AND stock_qty IS NULL) OR
    (stock_unlimited = false AND stock_qty IS NOT NULL AND stock_qty >= 0)
  ),
  -- photo_alt obligatoire dès qu'il y a une photo_url (a11y/SEO)
  CONSTRAINT photo_alt_required CHECK (photo_url IS NULL OR photo_alt IS NOT NULL)
);

CREATE INDEX products_producer_idx ON products(producer_id);
CREATE INDEX products_collection_point_idx ON products(collection_point_id);
CREATE INDEX products_status_idx ON products(status);

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- sales
-- ============================================================================

CREATE TABLE sales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_point_id   uuid NOT NULL REFERENCES collection_points(id),
  distribution_date     date NOT NULL,
  distribution_start_at timestamptz,
  distribution_end_at   timestamptz,
  closes_at             timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'distributed', 'cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sales_collection_point_idx ON sales(collection_point_id);
-- Index spécifique pour le cron close-sales (UPDATE ... WHERE status='open' AND closes_at < now())
CREATE INDEX sales_open_closes_at_idx ON sales(closes_at) WHERE status = 'open';

CREATE TRIGGER sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- orders & order_lines
-- ============================================================================

CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id   uuid NOT NULL REFERENCES users(id),
  sale_id          uuid NOT NULL REFERENCES sales(id),
  status           text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_payment', 'confirmed', 'cancelled', 'payment_failed')),
  total_ht_cents   int NOT NULL DEFAULT 0,
  total_tva_cents  int NOT NULL DEFAULT 0,
  total_ttc_cents  int NOT NULL DEFAULT 0,
  locked_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, sale_id)
);

CREATE INDEX orders_sale_status_idx ON orders(sale_id, status);
CREATE INDEX orders_client_idx ON orders(client_user_id);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_lines (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id                  uuid NOT NULL REFERENCES products(id),
  producer_id                 uuid NOT NULL REFERENCES producers(id),
  qty                         int NOT NULL CHECK (qty > 0),
  unit_price_ht_cents         int NOT NULL CHECK (unit_price_ht_cents > 0),
  vat_rate                    int NOT NULL CHECK (vat_rate IN (0, 6, 21)),
  platform_commission_bps     int NOT NULL CHECK (platform_commission_bps >= 0),
  coordinator_commission_bps  int NOT NULL DEFAULT 0 CHECK (coordinator_commission_bps >= 0),
  status                      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_lines_order_idx ON order_lines(order_id);
CREATE INDEX order_lines_producer_idx ON order_lines(producer_id);
CREATE INDEX order_lines_product_idx ON order_lines(product_id);

-- ============================================================================
-- cart_items
-- ============================================================================

CREATE TABLE cart_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sale_id         uuid NOT NULL REFERENCES sales(id),
  product_id      uuid NOT NULL REFERENCES products(id),
  qty             int NOT NULL CHECK (qty > 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, product_id)
);

CREATE INDEX cart_items_user_sale_idx ON cart_items(client_user_id, sale_id);

CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- payments & payment_webhook_events
-- ============================================================================

CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  provider            text NOT NULL DEFAULT 'mollie',
  provider_payment_id text NOT NULL,
  amount_cents        int NOT NULL CHECK (amount_cents > 0),
  status              text NOT NULL
    CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payload             jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);

CREATE INDEX payments_order_idx ON payments(order_id);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment_webhook_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL,
  provider_event_id   text,
  provider_payment_id text NOT NULL,
  payload             jsonb NOT NULL,
  processed           boolean NOT NULL DEFAULT false,
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id, provider_event_id)
);

CREATE INDEX payment_webhook_events_pending_idx
  ON payment_webhook_events(created_at) WHERE processed = false;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE producers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_points      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- users : user sees/updates own row ; admin tout
CREATE POLICY users_select_own   ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_update_own   ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY users_admin_all    ON users FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- settings : admin uniquement (service_role bypass pour usage serveur)
CREATE POLICY settings_admin_all ON settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- producers : lecture publique sur actifs ; admin tout
CREATE POLICY producers_public_read ON producers FOR SELECT USING (status = 'active');
CREATE POLICY producers_admin_all   ON producers FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- collection_points : lecture publique sur actifs ; admin tout
CREATE POLICY collection_points_public_read ON collection_points FOR SELECT USING (status = 'active');
CREATE POLICY collection_points_admin_all   ON collection_points FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- products : lecture publique sur actifs ; admin tout
CREATE POLICY products_public_read ON products FOR SELECT USING (status = 'active');
CREATE POLICY products_admin_all   ON products FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- sales : lecture publique hors draft/cancelled ; admin tout
CREATE POLICY sales_public_read ON sales FOR SELECT USING (status IN ('open', 'closed', 'distributed'));
CREATE POLICY sales_admin_all   ON sales FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- orders : le client voit et crée les siens ; admin tout
CREATE POLICY orders_client_select ON orders FOR SELECT USING (client_user_id = auth.uid());
CREATE POLICY orders_client_insert ON orders FOR INSERT WITH CHECK (client_user_id = auth.uid());
CREATE POLICY orders_client_update ON orders FOR UPDATE USING (client_user_id = auth.uid()) WITH CHECK (client_user_id = auth.uid());
CREATE POLICY orders_admin_all     ON orders FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- order_lines : via ownership de l'order ; admin tout
CREATE POLICY order_lines_client_select ON order_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_lines.order_id AND o.client_user_id = auth.uid())
);
CREATE POLICY order_lines_client_insert ON order_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_lines.order_id AND o.client_user_id = auth.uid())
);
CREATE POLICY order_lines_admin_all ON order_lines FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- cart_items : le client voit/écrit les siens ; admin tout
CREATE POLICY cart_items_client_all ON cart_items FOR ALL
  USING (client_user_id = auth.uid()) WITH CHECK (client_user_id = auth.uid());
CREATE POLICY cart_items_admin_all  ON cart_items FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- payments : le client voit les siens (via order) ; admin tout
CREATE POLICY payments_client_select ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.client_user_id = auth.uid())
);
CREATE POLICY payments_admin_all ON payments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- payment_webhook_events : admin uniquement (webhook handler utilise service_role qui bypass)
CREATE POLICY webhook_events_admin_all ON payment_webhook_events FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- Seed
-- ============================================================================

INSERT INTO settings (key, value) VALUES
  ('platform_commission_bps', '3500');
