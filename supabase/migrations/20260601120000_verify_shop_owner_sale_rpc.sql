-- Reliable shop-owner sale approve/reject (client UPDATE+SELECT was blocked by RLS edge cases).

CREATE OR REPLACE FUNCTION public.verify_shop_owner_sale(
  p_sale_id uuid,
  p_status public.verification_status
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Status must be verified or rejected';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF v_sale.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale was removed from the list';
  END IF;

  IF v_sale.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending sales can be approved or rejected';
  END IF;

  IF private.is_admin_or_main(v_uid) THEN
    NULL;
  ELSIF private.has_role(v_uid, 'merchant'::public.app_role) THEN
    IF v_sale.shop_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.shops s
      WHERE s.id = v_sale.shop_id
        AND s.created_by = v_uid
    ) THEN
      RAISE EXCEPTION 'You can only verify sales for your own shop';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not allowed to verify this sale';
  END IF;

  UPDATE public.sales
  SET
    status = p_status,
    verified_by = v_uid,
    verified_at = timezone('utc', now()),
    bill_number = CASE
      WHEN p_status = 'verified'
        AND (v_sale.bill_number IS NULL OR btrim(v_sale.bill_number) = '')
      THEN public.next_groobey_sale_bill_number()
      ELSE v_sale.bill_number
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_sale_id
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_shop_owner_sale(uuid, public.verification_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_shop_owner_sale(uuid, public.verification_status)
  TO authenticated, service_role;

-- Shop owners can read sales for shops they own (needed for lists and UPDATE RETURNING).
DROP POLICY IF EXISTS "Shop owners view sales for their shops" ON public.sales;
CREATE POLICY "Shop owners view sales for their shops"
ON public.sales
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'merchant'::public.app_role)
  AND shop_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = sales.shop_id
      AND s.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Shop owners view sale items for their shops" ON public.sale_items;
CREATE POLICY "Shop owners view sale items for their shops"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales
    INNER JOIN public.shops s ON s.id = sales.shop_id
    WHERE sales.id = sale_items.sale_id
      AND s.created_by = auth.uid()
      AND private.has_role(auth.uid(), 'merchant'::public.app_role)
  )
);
