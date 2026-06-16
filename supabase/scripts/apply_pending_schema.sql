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

-- === From 20260608140000_register_customer_self_rpc.sql ===
CREATE OR REPLACE FUNCTION public.register_customer_self(
  p_display_name text,
  p_email text,
  p_phone text,
  p_default_address text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_assignment record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(coalesce(p_display_name, '')) = '' THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  INSERT INTO public.profiles (
    user_id,
    display_name,
    email,
    phone,
    default_address,
    is_active
  )
  VALUES (
    v_uid,
    trim(p_display_name),
    v_email,
    nullif(trim(p_phone), ''),
    nullif(trim(p_default_address), ''),
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    default_address = EXCLUDED.default_address,
    is_active = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'customer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  FOR v_assignment IN
    SELECT role, display_name
    FROM public.staff_email_assignments
    WHERE email = v_email
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, v_assignment.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    IF v_assignment.display_name IS NOT NULL AND trim(v_assignment.display_name) <> '' THEN
      UPDATE public.profiles
      SET display_name = coalesce(nullif(trim(display_name), ''), trim(v_assignment.display_name))
      WHERE user_id = v_uid;
    END IF;
  END LOOP;

  DELETE FROM public.staff_email_assignments
  WHERE email = v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_self(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_self(text, text, text, text) TO authenticated;

-- === From 20260602120000 + 20260602120001 (customer role + policies) ===
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_address TEXT;

DROP POLICY IF EXISTS "Only Platform Admin can update profiles" ON public.profiles;
CREATE POLICY "Platform admin updates profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'main_admin'::public.app_role));

DROP POLICY IF EXISTS "Customers update own profile" ON public.profiles;
CREATE POLICY "Customers update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND private.has_role(auth.uid(), 'customer'::public.app_role))
WITH CHECK (user_id = auth.uid() AND private.has_role(auth.uid(), 'customer'::public.app_role));

DROP POLICY IF EXISTS "Order takers create own orders" ON public.customer_orders;
CREATE POLICY "Staff and customers create own orders"
ON public.customer_orders FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'order_taker'::public.app_role)
    OR private.has_role(auth.uid(), 'customer'::public.app_role)
    OR private.is_admin_or_main(auth.uid())
  )
);

DROP POLICY IF EXISTS "Order takers view own orders and admins view all" ON public.customer_orders;
CREATE POLICY "Creators and admins view customer orders"
ON public.customer_orders FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
  OR private.has_role(auth.uid(), 'employee'::public.app_role)
  OR private.has_role(auth.uid(), 'merchant'::public.app_role)
);

DROP POLICY IF EXISTS "Order takers update own orders and admins update all" ON public.customer_orders;
CREATE POLICY "Creators and admins update customer orders"
ON public.customer_orders FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR private.is_admin_or_main(auth.uid()))
WITH CHECK (created_by = auth.uid() OR private.is_admin_or_main(auth.uid()));

-- === From 20260603120000_staff_email_assignments.sql ===
CREATE TABLE IF NOT EXISTS public.staff_email_assignments (
  email text PRIMARY KEY,
  role public.app_role NOT NULL,
  display_name text,
  assigned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_email_assignments_staff_role CHECK (
    role IN ('employee'::public.app_role, 'order_taker'::public.app_role, 'merchant'::public.app_role)
  )
);
ALTER TABLE public.staff_email_assignments ENABLE ROW LEVEL SECURITY;

-- === From 20260608120000_profiles_shop_slug.sql ===
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_shop_slug_unique
  ON public.profiles (shop_slug) WHERE shop_slug IS NOT NULL;

-- === From 20260608150000_guest_shop_catalog_and_order_retention.sql ===
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active shops" ON public.shops;
CREATE POLICY "Anyone can view active shops"
ON public.shops FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE OR REPLACE FUNCTION public.purge_my_old_customer_orders(p_days int DEFAULT 15)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF p_days < 1 THEN p_days := 15; END IF;
  UPDATE public.customer_orders
  SET deleted_at = now()
  WHERE created_by = auth.uid()
    AND deleted_at IS NULL
    AND created_at < (now() - make_interval(days => p_days));
END;
$$;
REVOKE ALL ON FUNCTION public.purge_my_old_customer_orders(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_my_old_customer_orders(int) TO authenticated;

-- === From 20260608160000_shop_combos.sql (combo packs for customer shop + admin) ===
-- Paste this block in SQL Editor if npm run db:push is unavailable.

CREATE TABLE IF NOT EXISTS public.shop_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_combos_price_nonnegative CHECK (price >= 0)
);

ALTER TABLE public.shop_combos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_shop_combos_updated_at ON public.shop_combos;
CREATE TRIGGER update_shop_combos_updated_at
BEFORE UPDATE ON public.shop_combos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Anyone can view active shop combos" ON public.shop_combos;
CREATE POLICY "Anyone can view active shop combos"
ON public.shop_combos FOR SELECT TO anon, authenticated
USING (is_active = true OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can create shop combos" ON public.shop_combos;
CREATE POLICY "Admins can create shop combos"
ON public.shop_combos FOR INSERT TO authenticated
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can update shop combos" ON public.shop_combos;
CREATE POLICY "Admins can update shop combos"
ON public.shop_combos FOR UPDATE TO authenticated
USING (private.is_admin_or_main(auth.uid()))
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete shop combos" ON public.shop_combos;
CREATE POLICY "Admins can delete shop combos"
ON public.shop_combos FOR DELETE TO authenticated
USING (private.is_admin_or_main(auth.uid()));

ALTER TABLE public.shop_combos REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shop_combos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_combos;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-combo-images', 'shop-combo-images', true, 3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can view combo images" ON storage.objects;
CREATE POLICY "Anyone can view combo images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'shop-combo-images');

DROP POLICY IF EXISTS "Admins can upload combo images" ON storage.objects;
CREATE POLICY "Admins can upload combo images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shop-combo-images' AND private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can update combo images" ON storage.objects;
CREATE POLICY "Admins can update combo images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shop-combo-images' AND private.is_admin_or_main(auth.uid()))
WITH CHECK (bucket_id = 'shop-combo-images' AND private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete combo images" ON storage.objects;
CREATE POLICY "Admins can delete combo images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shop-combo-images' AND private.is_admin_or_main(auth.uid()));

CREATE OR REPLACE FUNCTION public.ensure_shop_combos_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.shop_combos') IS NULL THEN
    RAISE EXCEPTION 'shop_combos table missing. Run npm run db:push or paste 20260608160000_shop_combos.sql in Supabase SQL Editor.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_shop_combos_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_shop_combos_schema() TO authenticated, service_role;

-- === From 20260616120000_products_out_of_stock.sql ===
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_out_of_stock IS
  'When true, product remains visible in the customer shop but cannot be added to cart.';

ALTER TABLE public.products REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_products_out_of_stock_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_out_of_stock'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN is_out_of_stock boolean NOT NULL DEFAULT false;
  END IF;

  ALTER TABLE public.products REPLICA IDENTITY FULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_products_out_of_stock_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_products_out_of_stock_schema() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
