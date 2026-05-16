-- Dual pricing: price = customer retail; merchant_unit_price = shop settlement rate per unit.
-- sale_items.unit_price = retail snapshot; sale_items.merchant_unit_price = trade snapshot.
-- sales.bill_number / customer_orders.bill_number = friendly GB-YYYY-NNNNNN (global sequence).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS merchant_unit_price numeric(12, 2) NOT NULL DEFAULT 0;

UPDATE public.products
SET merchant_unit_price = price
WHERE merchant_unit_price = 0 OR merchant_unit_price IS NULL;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS merchant_unit_price numeric(12, 2) NOT NULL DEFAULT 0;

UPDATE public.sale_items
SET merchant_unit_price = unit_price
WHERE merchant_unit_price = 0 OR merchant_unit_price IS NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS bill_number text;

CREATE UNIQUE INDEX IF NOT EXISTS sales_bill_number_key
  ON public.sales (bill_number)
  WHERE bill_number IS NOT NULL;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS bill_number text;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS merchant_settlement_amount numeric(12, 2);

UPDATE public.customer_orders
SET merchant_settlement_amount = total_amount
WHERE merchant_settlement_amount IS NULL;

ALTER TABLE public.customer_orders
  ALTER COLUMN merchant_settlement_amount SET DEFAULT 0;

ALTER TABLE public.customer_orders
  ALTER COLUMN merchant_settlement_amount SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_orders_bill_number_key
  ON public.customer_orders (bill_number)
  WHERE bill_number IS NOT NULL;

-- Single-row global bill counter (UTC year rollover resets sequence to 1).
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
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := (EXTRACT(YEAR FROM (timezone('utc', now())))::int);
  n bigint;
  rec public.groobey_bill_sequence%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.groobey_bill_sequence WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.groobey_bill_sequence (id, year, seq)
    VALUES (1, y, 1)
    RETURNING seq INTO n;
  ELSE
    IF rec.year = y THEN
      n := rec.seq + 1;
    ELSE
      n := 1;
    END IF;
    UPDATE public.groobey_bill_sequence
    SET year = y, seq = n, updated_at = timezone('utc', now())
    WHERE id = 1;
  END IF;
  RETURN format('GB-%s-%s', y, lpad(n::text, 6, '0'));
END;
$$;

REVOKE ALL ON FUNCTION public.next_groobey_bill_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_groobey_bill_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_groobey_bill_number() TO service_role;
