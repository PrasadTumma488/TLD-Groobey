-- Separate Bill ID streams: GBS-* shop sales, GCO-* order-taker customer orders.
-- Legacy GB-* numbers already issued stay valid.

CREATE TABLE IF NOT EXISTS public.groobey_bill_counters (
  bill_kind text PRIMARY KEY,
  prefix text NOT NULL,
  year int NOT NULL,
  seq bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groobey_bill_counters_kind_check
    CHECK (bill_kind IN ('sale', 'customer_order'))
);

INSERT INTO public.groobey_bill_counters (bill_kind, prefix, year, seq)
VALUES
  ('sale', 'GBS', (EXTRACT(YEAR FROM (timezone('utc', now())))::int), 0),
  ('customer_order', 'GCO', (EXTRACT(YEAR FROM (timezone('utc', now())))::int), 0)
ON CONFLICT (bill_kind) DO NOTHING;

-- Seed counters from legacy single-row sequence when present.
DO $$
DECLARE
  legacy_year int;
  legacy_seq bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'groobey_bill_sequence'
  ) THEN
    SELECT year, seq INTO legacy_year, legacy_seq
    FROM public.groobey_bill_sequence
    WHERE id = 1;
    IF legacy_seq IS NOT NULL AND legacy_seq > 0 THEN
      UPDATE public.groobey_bill_counters
      SET year = legacy_year, seq = GREATEST(seq, legacy_seq)
      WHERE bill_kind = 'sale';
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.next_groobey_bill_number_for_kind(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := (EXTRACT(YEAR FROM (timezone('utc', now())))::int);
  n bigint;
  p text;
  rec public.groobey_bill_counters%ROWTYPE;
BEGIN
  IF p_kind NOT IN ('sale', 'customer_order') THEN
    RAISE EXCEPTION 'Unknown bill kind: %', p_kind;
  END IF;

  SELECT * INTO rec FROM public.groobey_bill_counters WHERE bill_kind = p_kind FOR UPDATE;
  IF NOT FOUND THEN
    p := CASE p_kind WHEN 'customer_order' THEN 'GCO' ELSE 'GBS' END;
    INSERT INTO public.groobey_bill_counters (bill_kind, prefix, year, seq)
    VALUES (p_kind, p, y, 1)
    RETURNING seq INTO n;
  ELSE
    p := rec.prefix;
    IF rec.year = y THEN
      n := rec.seq + 1;
    ELSE
      n := 1;
    END IF;
    UPDATE public.groobey_bill_counters
    SET year = y, seq = n, updated_at = timezone('utc', now())
    WHERE bill_kind = p_kind;
  END IF;

  RETURN format('%s-%s-%s', p, y, lpad(n::text, 6, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.next_groobey_sale_bill_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.next_groobey_bill_number_for_kind('sale');
$$;

CREATE OR REPLACE FUNCTION public.next_groobey_customer_order_bill_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.next_groobey_bill_number_for_kind('customer_order');
$$;

-- Backward compatible: shop sales (was mixed GB-* with orders).
CREATE OR REPLACE FUNCTION public.next_groobey_bill_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.next_groobey_sale_bill_number();
$$;

REVOKE ALL ON FUNCTION public.next_groobey_bill_number_for_kind(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_groobey_sale_bill_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_groobey_customer_order_bill_number() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.next_groobey_bill_number_for_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_groobey_sale_bill_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_groobey_customer_order_bill_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_groobey_bill_number() TO authenticated, service_role;

COMMENT ON FUNCTION public.next_groobey_sale_bill_number IS
  'Shop/merchant sale bills: GBS-YYYY-NNNNNN';
COMMENT ON FUNCTION public.next_groobey_customer_order_bill_number IS
  'Order-taker customer orders: GCO-YYYY-NNNNNN';
