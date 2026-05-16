-- Assign Bill IDs to customer orders (and sales) that were saved without bill_number.

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
    new_no := public.next_groobey_customer_order_bill_number();
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
    new_no := public.next_groobey_sale_bill_number();
    UPDATE public.sales
    SET bill_number = new_no, updated_at = timezone('utc', now())
    WHERE id = r.id;
    sale_id := r.id;
    new_bill_number := new_no;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_my_customer_order_bill_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_my_sale_bill_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_my_customer_order_bill_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_my_sale_bill_ids() TO authenticated, service_role;
