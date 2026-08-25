-- Production store contracts: stock-aware checkout, coupons, operator statuses,
-- and one-time Zity Points awards per order.

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 999999 CHECK (stock_quantity >= 0);
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS odoo_product_id INTEGER,
  ADD COLUMN IF NOT EXISTS odoo_product_sku TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_products_sku_unique
  ON public.store_products(sku)
  WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_products_odoo_product_id
  ON public.store_products(odoo_product_id)
  WHERE odoo_product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.store_coupons (
  code TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount_amount NUMERIC(12,2) CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.store_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons_read_active" ON public.store_coupons;
CREATE POLICY "coupons_read_active" ON public.store_coupons
  FOR SELECT USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  );

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending',
      'paid',
      'packing',
      'shipping',
      'delivered',
      'delivering',
      'completed',
      'cancelled'
    )
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS odoo_order_ref TEXT,
  ADD COLUMN IF NOT EXISTS odoo_order_id INTEGER,
  ADD COLUMN IF NOT EXISTS odoo_invoice_id INTEGER,
  ADD COLUMN IF NOT EXISTS odoo_invoice_ref TEXT,
  ADD COLUMN IF NOT EXISTS odoo_invoice_status TEXT,
  ADD COLUMN IF NOT EXISTS odoo_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS odoo_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS odoo_sync_attempts INTEGER NOT NULL DEFAULT 0 CHECK (odoo_sync_attempts >= 0),
  ADD COLUMN IF NOT EXISTS odoo_last_sync_attempt_at TIMESTAMPTZ;

UPDATE public.orders
SET external_order_id = order_ref
WHERE external_order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_order_id_unique
  ON public.orders(external_order_id)
  WHERE external_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_odoo_order_ref_unique
  ON public.orders(odoo_order_ref)
  WHERE odoo_order_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_odoo_order_id_unique
  ON public.orders(odoo_order_id)
  WHERE odoo_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.odoo_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_ref TEXT,
  external_order_id TEXT,
  direction TEXT NOT NULL DEFAULT 'chef_to_odoo',
  operation TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error', 'failed', 'info')),
  message TEXT NOT NULL,
  details JSONB,
  request_payload JSONB NOT NULL DEFAULT '{}',
  response_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.odoo_sync_logs
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'chef_to_odoo',
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS request_payload JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS response_payload JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_odoo_sync_logs_created_at ON public.odoo_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odoo_sync_logs_order_id ON public.odoo_sync_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_odoo_sync_logs_status ON public.odoo_sync_logs(status);
ALTER TABLE public.odoo_sync_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odoo_sync_logs FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.zity_points_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_ref TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  points INTEGER NOT NULL CHECK (points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_zity_points_user_id ON public.zity_points_ledger(user_id);
ALTER TABLE public.zity_points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "points_own" ON public.zity_points_ledger;
CREATE POLICY "points_own" ON public.zity_points_ledger
  FOR SELECT USING (auth.uid() = user_id);
