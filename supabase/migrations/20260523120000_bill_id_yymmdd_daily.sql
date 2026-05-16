-- Bill ID format: YYMMDD-NN (daily sequence in Asia/Kolkata), e.g. 260516-01.
-- One global counter for shop sales + customer orders (no GB/GCO prefix).

CREATE OR REPLACE FUNCTION public.groobey_bill_day_ist(p_ts timestamptz DEFAULT timezone('utc', now()))
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (EXTRACT(YEAR FROM timezone('Asia/Kolkata', p_ts))::int % 100) * 10000
    + EXTRACT(MONTH FROM timezone('Asia/Kolkata', p_ts))::int * 100
    + EXTRACT(DAY FROM timezone('Asia/Kolkata', p_ts))::int
  )::int;
$$;

COMMENT ON FUNCTION public.groobey_bill_day_ist IS
  'Calendar day key YYMMDD in Asia/Kolkata (e.g. 260516 for 16 May 2026).';

CREATE OR REPLACE FUNCTION public.groobey_format_daily_bill_number(p_day int, p_seq bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_day::text || '-' || CASE
    WHEN p_seq < 10 THEN lpad(p_seq::text, 2, '0')
    ELSE p_seq::text
  END;
$$;

ALTER TABLE public.groobey_bill_counters DROP CONSTRAINT IF EXISTS groobey_bill_counters_kind_check;
ALTER TABLE public.groobey_bill_counters
  ADD CONSTRAINT groobey_bill_counters_kind_check
  CHECK (bill_kind IN ('sale', 'customer_order', 'global'));

INSERT INTO public.groobey_bill_counters (bill_kind, prefix, year, seq)
VALUES ('global', '', 0, 0)
ON CONFLICT (bill_kind) DO NOTHING;

COMMENT ON COLUMN public.groobey_bill_counters.year IS
  'Bill day YYMMDD (Asia/Kolkata); sequence resets when day changes.';

-- Reformat every existing sale + order bill_number (chronological per day, shared sequence).
DO $$
DECLARE
  max_today bigint := 0;
BEGIN
  WITH all_bills AS (
    SELECT
      'sale'::text AS src,
      s.id,
      COALESCE(s.sold_at, s.created_at) AS ts
    FROM public.sales s
    UNION ALL
    SELECT
      'customer_order'::text,
      o.id,
      o.created_at
    FROM public.customer_orders o
  ),
  ranked AS (
    SELECT
      src,
      id,
      public.groobey_bill_day_ist(ts) AS bill_day,
      row_number() OVER (
        PARTITION BY public.groobey_bill_day_ist(ts)
        ORDER BY ts ASC, src, id
      ) AS n
    FROM all_bills
  )
  UPDATE public.sales s
  SET
    bill_number = public.groobey_format_daily_bill_number(ranked.bill_day, ranked.n),
    updated_at = timezone('utc', now())
  FROM ranked
  WHERE ranked.src = 'sale' AND ranked.id = s.id;

  WITH all_bills AS (
    SELECT
      'sale'::text AS src,
      s.id,
      COALESCE(s.sold_at, s.created_at) AS ts
    FROM public.sales s
    UNION ALL
    SELECT
      'customer_order'::text,
      o.id,
      o.created_at
    FROM public.customer_orders o
  ),
  ranked AS (
    SELECT
      src,
      id,
      public.groobey_bill_day_ist(ts) AS bill_day,
      row_number() OVER (
        PARTITION BY public.groobey_bill_day_ist(ts)
        ORDER BY ts ASC, src, id
      ) AS n
    FROM all_bills
  )
  UPDATE public.customer_orders o
  SET
    bill_number = public.groobey_format_daily_bill_number(ranked.bill_day, ranked.n),
    updated_at = timezone('utc', now())
  FROM ranked
  WHERE ranked.src = 'customer_order' AND ranked.id = o.id;

  SELECT COALESCE(MAX(seq_tail), 0)
  INTO max_today
  FROM (
    SELECT NULLIF(split_part(bill_number, '-', 2), '')::bigint AS seq_tail
    FROM public.sales
    WHERE bill_number ~ '^\d{6}-\d+$'
      AND split_part(bill_number, '-', 1)::int = public.groobey_bill_day_ist(now())
    UNION ALL
    SELECT NULLIF(split_part(bill_number, '-', 2), '')::bigint
    FROM public.customer_orders
    WHERE bill_number ~ '^\d{6}-\d+$'
      AND split_part(bill_number, '-', 1)::int = public.groobey_bill_day_ist(now())
  ) today;

  UPDATE public.groobey_bill_counters
  SET
    year = public.groobey_bill_day_ist(now()),
    seq = GREATEST(seq, COALESCE(max_today, 0)),
    prefix = '',
    updated_at = timezone('utc', now())
  WHERE bill_kind = 'global';
END $$;

CREATE OR REPLACE FUNCTION public.next_groobey_daily_bill_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill_day int := public.groobey_bill_day_ist(now());
  n bigint;
  rec public.groobey_bill_counters%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.groobey_bill_counters WHERE bill_kind = 'global' FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.groobey_bill_counters (bill_kind, prefix, year, seq)
    VALUES ('global', '', bill_day, 1)
    RETURNING seq INTO n;
  ELSE
    IF rec.year = bill_day THEN
      n := rec.seq + 1;
    ELSE
      n := 1;
    END IF;
    UPDATE public.groobey_bill_counters
    SET year = bill_day, seq = n, prefix = '', updated_at = timezone('utc', now())
    WHERE bill_kind = 'global';
  END IF;

  RETURN public.groobey_format_daily_bill_number(bill_day, n);
END;
$$;

CREATE OR REPLACE FUNCTION public.next_groobey_bill_number_for_kind(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_kind NOT IN ('sale', 'customer_order') THEN
    RAISE EXCEPTION 'Unknown bill kind: %', p_kind;
  END IF;
  RETURN public.next_groobey_daily_bill_number();
END;
$$;

CREATE OR REPLACE FUNCTION public.next_groobey_sale_bill_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.next_groobey_daily_bill_number();
END;
$$;

CREATE OR REPLACE FUNCTION public.next_groobey_customer_order_bill_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.next_groobey_daily_bill_number();
END;
$$;

CREATE OR REPLACE FUNCTION public.next_groobey_bill_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.next_groobey_daily_bill_number();
END;
$$;

COMMENT ON FUNCTION public.next_groobey_daily_bill_number IS
  'Global Bill ID: YYMMDD-NN (Asia/Kolkata calendar day, NN = daily sequence from 01).';
COMMENT ON FUNCTION public.next_groobey_sale_bill_number IS
  'Same as next_groobey_daily_bill_number (YYMMDD-NN).';
COMMENT ON FUNCTION public.next_groobey_customer_order_bill_number IS
  'Same as next_groobey_daily_bill_number (YYMMDD-NN).';

REVOKE ALL ON FUNCTION public.next_groobey_daily_bill_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_groobey_daily_bill_number() TO authenticated, service_role;

-- Missing bill_number rows use the same daily allocator.
CREATE OR REPLACE FUNCTION public.backfill_my_customer_order_bill_ids()
RETURNS TABLE(order_id uuid, new_bill_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.customer_orders%ROWTYPE;
  new_no text;
BEGIN
  FOR r IN
    SELECT *
    FROM public.customer_orders
    WHERE created_by = auth.uid()
      AND (bill_number IS NULL OR btrim(bill_number) = '')
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    new_no := public.next_groobey_daily_bill_number();
    UPDATE public.customer_orders
    SET bill_number = new_no, updated_at = timezone('utc', now())
    WHERE id = r.id;
    order_id := r.id;
    new_bill_number := new_no;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_my_sale_bill_ids()
RETURNS TABLE(sale_id uuid, new_bill_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.sales%ROWTYPE;
  new_no text;
BEGIN
  FOR r IN
    SELECT *
    FROM public.sales
    WHERE created_by = auth.uid()
      AND (bill_number IS NULL OR btrim(bill_number) = '')
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    new_no := public.next_groobey_daily_bill_number();
    UPDATE public.sales
    SET bill_number = new_no, updated_at = timezone('utc', now())
    WHERE id = r.id;
    sale_id := r.id;
    new_bill_number := new_no;
    RETURN NEXT;
  END LOOP;
END;
$$;
