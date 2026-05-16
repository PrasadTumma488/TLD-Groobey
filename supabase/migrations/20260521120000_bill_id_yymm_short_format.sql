-- Short Bill IDs: GCO-YYMM-NNNN (customer orders), GB-YYMM-NNNN (shop sales).
-- YYMM = year%100 * 100 + month, e.g. May 2026 → 2605. Legacy GB-/GBS-/GCO-2026-* stay valid.

UPDATE public.groobey_bill_counters
SET prefix = 'GB'
WHERE bill_kind = 'sale' AND prefix = 'GBS';

COMMENT ON COLUMN public.groobey_bill_counters.year IS
  'Billing period YYMM (e.g. 2605 = May 2026); resets sequence each month.';

CREATE OR REPLACE FUNCTION public.next_groobey_bill_number_for_kind(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := (EXTRACT(YEAR FROM (timezone('utc', now())))::int);
  m int := (EXTRACT(MONTH FROM (timezone('utc', now())))::int);
  period int := (y % 100) * 100 + m;
  n bigint;
  p text;
  rec public.groobey_bill_counters%ROWTYPE;
BEGIN
  IF p_kind NOT IN ('sale', 'customer_order') THEN
    RAISE EXCEPTION 'Unknown bill kind: %', p_kind;
  END IF;

  SELECT * INTO rec FROM public.groobey_bill_counters WHERE bill_kind = p_kind FOR UPDATE;
  IF NOT FOUND THEN
    p := CASE p_kind WHEN 'customer_order' THEN 'GCO' ELSE 'GB' END;
    INSERT INTO public.groobey_bill_counters (bill_kind, prefix, year, seq)
    VALUES (p_kind, p, period, 1)
    RETURNING seq INTO n;
  ELSE
    p := rec.prefix;
    IF p = 'GBS' THEN
      p := 'GB';
    END IF;
    IF rec.year = period THEN
      n := rec.seq + 1;
    ELSE
      n := 1;
    END IF;
    UPDATE public.groobey_bill_counters
    SET prefix = p, year = period, seq = n, updated_at = timezone('utc', now())
    WHERE bill_kind = p_kind;
  END IF;

  RETURN format('%s-%s-%s', p, period, lpad(n::text, 4, '0'));
END;
$$;

COMMENT ON FUNCTION public.next_groobey_sale_bill_number IS
  'Shop sale bills: GB-YYMM-NNNN (e.g. GB-2605-0042)';
COMMENT ON FUNCTION public.next_groobey_customer_order_bill_number IS
  'Customer orders: GCO-YYMM-NNNN (e.g. GCO-2605-0042)';

-- Seed counters from existing bills in current YYMM (any PREFIX-YYMM-SEQ shape).
DO $$
DECLARE
  period int := (
    (EXTRACT(YEAR FROM (timezone('utc', now())))::int % 100) * 100
    + EXTRACT(MONTH FROM (timezone('utc', now())))::int
  );
  max_sale_seq bigint := 0;
  max_order_seq bigint := 0;
BEGIN
  SELECT COALESCE(MAX((regexp_match(btrim(bill_number), '^[A-Z]+-([0-9]+)-([0-9]+)$'))[2]::bigint), 0)
  INTO max_sale_seq
  FROM public.sales
  WHERE bill_number IS NOT NULL
    AND btrim(bill_number) <> ''
    AND bill_number ~ '^[A-Z]+-[0-9]+-[0-9]+$'
    AND (regexp_match(btrim(bill_number), '^[A-Z]+-([0-9]+)-'))[1]::int = period;

  SELECT COALESCE(MAX((regexp_match(btrim(bill_number), '^[A-Z]+-([0-9]+)-([0-9]+)$'))[2]::bigint), 0)
  INTO max_order_seq
  FROM public.customer_orders
  WHERE bill_number IS NOT NULL
    AND btrim(bill_number) <> ''
    AND bill_number ~ '^[A-Z]+-[0-9]+-[0-9]+$'
    AND (regexp_match(btrim(bill_number), '^[A-Z]+-([0-9]+)-'))[1]::int = period;

  UPDATE public.groobey_bill_counters
  SET year = period, seq = GREATEST(seq, max_sale_seq), updated_at = timezone('utc', now())
  WHERE bill_kind = 'sale';

  UPDATE public.groobey_bill_counters
  SET year = period, seq = GREATEST(seq, max_order_seq), updated_at = timezone('utc', now())
  WHERE bill_kind = 'customer_order';
END $$;
