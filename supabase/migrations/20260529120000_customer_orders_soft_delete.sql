-- Soft-delete order taker bills: hide from admin list; keep for settlement export.

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.customer_orders.deleted_at IS
  'When set, bill is hidden from Order taker bills list but still counts in settlement export.';

CREATE INDEX IF NOT EXISTS idx_customer_orders_active_created_at
  ON public.customer_orders (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.archive_customer_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  IF NOT private.is_admin_or_main(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform admin can remove order taker bills';
  END IF;

  UPDATE public.customer_orders
  SET
    deleted_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE id = p_order_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count = 0 THEN
    RAISE EXCEPTION 'Order bill not found or already removed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_customer_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_customer_order(uuid) TO authenticated, service_role;
