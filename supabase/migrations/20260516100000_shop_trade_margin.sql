-- Shop-wide Groobey margin % (0–100): trade = retail × (1 − margin/100).
-- Shops: shop owners. Profiles: order takers. Sales/orders: snapshot at create time.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS trade_margin_percent numeric(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_trade_margin_percent_range;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_trade_margin_percent_range
  CHECK (trade_margin_percent >= 0 AND trade_margin_percent <= 100);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS trade_margin_percent_applied numeric(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trade_margin_percent numeric(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_trade_margin_percent_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_trade_margin_percent_range
  CHECK (trade_margin_percent >= 0 AND trade_margin_percent <= 100);

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS trade_margin_percent_applied numeric(5, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shops.trade_margin_percent IS
  'Groobey margin % off retail for this shop (shop owner sales).';

COMMENT ON COLUMN public.profiles.trade_margin_percent IS
  'Groobey margin % off retail for this order taker (phone/customer orders).';

COMMENT ON COLUMN public.sales.trade_margin_percent_applied IS
  'Snapshot of shops.trade_margin_percent when the sale was submitted.';

COMMENT ON COLUMN public.customer_orders.trade_margin_percent_applied IS
  'Snapshot of profiles.trade_margin_percent when the order was created.';

-- Order takers may set only their own margin (not other profile fields).
CREATE OR REPLACE FUNCTION public.set_my_trade_margin_percent(pct numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pct IS NULL OR pct < 0 OR pct > 100 THEN
    RAISE EXCEPTION 'Margin must be between 0 and 100';
  END IF;
  UPDATE public.profiles
  SET trade_margin_percent = pct, updated_at = timezone('utc', now())
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_trade_margin_percent(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_trade_margin_percent(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_trade_margin_percent(numeric) TO service_role;
