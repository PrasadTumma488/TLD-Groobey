-- Soft-delete sales: hide from workspace lists; keep rows for analytics and monthly settlement.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.sales.deleted_at IS
  'When set, sale is hidden from pipeline UI but still counts in period analytics and settlement.';

CREATE INDEX IF NOT EXISTS idx_sales_active_created_at
  ON public.sales (created_at DESC)
  WHERE deleted_at IS NULL;

-- Archive settled sale (shop owner own sale, or platform admin any sale).
CREATE OR REPLACE FUNCTION public.archive_sale(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'Sale id is required';
  END IF;

  IF private.is_admin_or_main(auth.uid()) THEN
    UPDATE public.sales
    SET
      deleted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    WHERE id = p_sale_id
      AND status IN ('verified', 'rejected')
      AND deleted_at IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  ELSE
    UPDATE public.sales
    SET
      deleted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    WHERE id = p_sale_id
      AND created_by = auth.uid()
      AND status IN ('verified', 'rejected')
      AND deleted_at IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  END IF;

  IF updated_count = 0 THEN
    RAISE EXCEPTION 'Sale not found, not settled yet, or already removed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_sale(uuid) TO authenticated, service_role;

-- Staff billing view: hide archived sales from delivery staff lists.
DROP POLICY IF EXISTS "Staff can view allowed sales" ON public.sales;
CREATE POLICY "Staff can view allowed sales"
ON public.sales
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
  OR (
    private.has_role(auth.uid(), 'employee')
    AND status = 'verified'
    AND deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Sale items follow sale visibility" ON public.sale_items;
CREATE POLICY "Sale items follow sale visibility"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales
    WHERE sales.id = sale_items.sale_id
      AND (
        sales.created_by = auth.uid()
        OR private.is_admin_or_main(auth.uid())
        OR (
          private.has_role(auth.uid(), 'employee')
          AND sales.status = 'verified'
          AND sales.deleted_at IS NULL
        )
      )
  )
);
