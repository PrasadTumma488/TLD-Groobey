-- Keep new GCO/GBS sequences ahead of existing bill_number values (including legacy GB-*).

DO $$
DECLARE
  y int := (EXTRACT(YEAR FROM (timezone('utc', now())))::int);
  max_sale_seq bigint := 0;
  max_order_seq bigint := 0;
BEGIN
  SELECT COALESCE(MAX(
    (regexp_match(btrim(bill_number), '^[A-Z]+-([0-9]{4})-([0-9]+)$'))[2]::bigint
  ), 0) INTO max_sale_seq
  FROM public.sales
  WHERE bill_number IS NOT NULL
    AND btrim(bill_number) <> ''
    AND bill_number ~ '^[A-Z]+-[0-9]{4}-[0-9]+$';

  SELECT COALESCE(MAX(
    (regexp_match(btrim(bill_number), '^[A-Z]+-([0-9]{4})-([0-9]+)$'))[2]::bigint
  ), 0) INTO max_order_seq
  FROM public.customer_orders
  WHERE bill_number IS NOT NULL
    AND btrim(bill_number) <> ''
    AND bill_number ~ '^[A-Z]+-[0-9]{4}-[0-9]+$';

  UPDATE public.groobey_bill_counters
  SET year = y, seq = GREATEST(seq, max_sale_seq), updated_at = timezone('utc', now())
  WHERE bill_kind = 'sale';

  UPDATE public.groobey_bill_counters
  SET year = y, seq = GREATEST(seq, max_order_seq), updated_at = timezone('utc', now())
  WHERE bill_kind = 'customer_order';
END $$;
