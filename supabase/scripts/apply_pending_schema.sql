-- Run in Supabase Dashboard → SQL Editor if `supabase db push` is not available.
-- Safe to run more than once (uses IF NOT EXISTS).

-- === From 20260515120000_dual_pricing_bills.sql (run if not already applied) ===
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS merchant_unit_price numeric(12, 2) NOT NULL DEFAULT 0;
UPDATE public.products SET merchant_unit_price = price
WHERE merchant_unit_price = 0 OR merchant_unit_price IS NULL;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS merchant_unit_price numeric(12, 2) NOT NULL DEFAULT 0;
UPDATE public.sale_items SET merchant_unit_price = unit_price
WHERE merchant_unit_price = 0 OR merchant_unit_price IS NULL;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS bill_number text;
CREATE UNIQUE INDEX IF NOT EXISTS sales_bill_number_key
  ON public.sales (bill_number) WHERE bill_number IS NOT NULL;

ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS bill_number text;
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS merchant_settlement_amount numeric(12, 2);
UPDATE public.customer_orders SET merchant_settlement_amount = total_amount
WHERE merchant_settlement_amount IS NULL;
ALTER TABLE public.customer_orders
  ALTER COLUMN merchant_settlement_amount SET DEFAULT 0;
ALTER TABLE public.customer_orders
  ALTER COLUMN merchant_settlement_amount SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.groobey_bill_sequence (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  year int NOT NULL,
  seq bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.groobey_bill_sequence (id, year, seq)
VALUES (1, (EXTRACT(YEAR FROM (timezone('utc', now())))::int), 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_groobey_bill_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y int := (EXTRACT(YEAR FROM (timezone('utc', now())))::int); n bigint;
BEGIN
  UPDATE public.groobey_bill_sequence SET seq = CASE WHEN year = y THEN seq + 1 ELSE 1 END, year = y,
    updated_at = timezone('utc', now()) WHERE id = 1 RETURNING seq INTO n;
  IF n IS NULL THEN
    INSERT INTO public.groobey_bill_sequence (id, year, seq) VALUES (1, y, 1) RETURNING seq INTO n;
  END IF;
  RETURN format('GB-%s-%s', y, lpad(n::text, 6, '0'));
END; $$;
REVOKE ALL ON FUNCTION public.next_groobey_bill_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_groobey_bill_number() TO authenticated, service_role;

-- === From 20260516100000_shop_trade_margin.sql ===
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS trade_margin_percent numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_trade_margin_percent_range;
ALTER TABLE public.shops ADD CONSTRAINT shops_trade_margin_percent_range
  CHECK (trade_margin_percent >= 0 AND trade_margin_percent <= 100);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS trade_margin_percent_applied numeric(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trade_margin_percent numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_trade_margin_percent_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_trade_margin_percent_range
  CHECK (trade_margin_percent >= 0 AND trade_margin_percent <= 100);

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS trade_margin_percent_applied numeric(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_my_trade_margin_percent(pct numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pct IS NULL OR pct < 0 OR pct > 100 THEN RAISE EXCEPTION 'Margin must be between 0 and 100'; END IF;
  UPDATE public.profiles SET trade_margin_percent = pct, updated_at = timezone('utc', now())
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found for current user'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_my_trade_margin_percent(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_trade_margin_percent(numeric) TO authenticated, service_role;

-- === From 20260517120000_sales_soft_delete.sql ===
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.archive_sale(p_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_count int;
BEGIN
  IF p_sale_id IS NULL THEN RAISE EXCEPTION 'Sale id is required'; END IF;
  IF private.is_admin_or_main(auth.uid()) THEN
    UPDATE public.sales SET deleted_at = timezone('utc', now()), updated_at = timezone('utc', now())
    WHERE id = p_sale_id AND status IN ('verified', 'rejected') AND deleted_at IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  ELSE
    UPDATE public.sales SET deleted_at = timezone('utc', now()), updated_at = timezone('utc', now())
    WHERE id = p_sale_id AND created_by = auth.uid()
      AND status IN ('verified', 'rejected') AND deleted_at IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  END IF;
  IF updated_count = 0 THEN RAISE EXCEPTION 'Sale not found, not settled yet, or already removed'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.archive_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_sale(uuid) TO authenticated, service_role;

-- === From 20260518120000_products_default_quantity.sql ===
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_quantity numeric(12, 3) NOT NULL DEFAULT 1;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_default_quantity_positive;
ALTER TABLE public.products
  ADD CONSTRAINT products_default_quantity_positive CHECK (default_quantity > 0);

-- === From 20260522120000_sale_items_product_unit.sql ===
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_unit text;

UPDATE public.sale_items si
SET product_unit = p.unit
FROM public.products p
WHERE si.product_id = p.id
  AND (si.product_unit IS NULL OR btrim(si.product_unit) = '');

-- === From 20260523120000_bill_id_yymmdd_daily.sql ===
-- Prefer: supabase db push (applies full migration). Or paste that file here in SQL Editor.

-- === From 20260524120000_customer_orders_delivery_fields.sql ===
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS grocery_subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_destination text,
  ADD COLUMN IF NOT EXISTS work_from_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS items_delivered_text text,
  ADD COLUMN IF NOT EXISTS delivery_time_slot text,
  ADD COLUMN IF NOT EXISTS assigned_delivery_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.customer_orders
SET grocery_subtotal = COALESCE(total_amount, 0)
WHERE grocery_subtotal = 0 AND COALESCE(total_amount, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_customer_orders_assigned_delivery
  ON public.customer_orders(assigned_delivery_user_id)
  WHERE assigned_delivery_user_id IS NOT NULL;

-- === From 20260525120000_delivery_staff_order_status_rls.sql + 20260528120000_delivery_mark_delivered_rls.sql ===
-- Run supabase/migrations/20260528120000_delivery_mark_delivered_rls.sql in SQL Editor (SELECT delivered + mark_assigned_order_status RPC).
