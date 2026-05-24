-- Shop owners can approve/reject sales for shops they own (RLS previously admin-only on UPDATE).

DROP POLICY IF EXISTS "Shop owners verify sales for their shops" ON public.sales;
CREATE POLICY "Shop owners verify sales for their shops"
ON public.sales
FOR UPDATE
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
)
WITH CHECK (
  private.has_role(auth.uid(), 'merchant'::public.app_role)
  AND shop_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = sales.shop_id
      AND s.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Shop owners update pending sale items" ON public.sale_items;
CREATE POLICY "Shop owners update pending sale items"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales
    INNER JOIN public.shops s ON s.id = sales.shop_id
    WHERE sales.id = sale_items.sale_id
      AND sales.status = 'pending'
      AND s.created_by = auth.uid()
      AND private.has_role(auth.uid(), 'merchant'::public.app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales
    INNER JOIN public.shops s ON s.id = sales.shop_id
    WHERE sales.id = sale_items.sale_id
      AND sales.status = 'pending'
      AND s.created_by = auth.uid()
      AND private.has_role(auth.uid(), 'merchant'::public.app_role)
  )
);
