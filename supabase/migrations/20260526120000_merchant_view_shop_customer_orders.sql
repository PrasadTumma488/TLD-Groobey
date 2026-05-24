-- Shop owners can receive realtime notifications for orders linked to their shops.
DROP POLICY IF EXISTS "Shop owners view orders for their shops" ON public.customer_orders;
CREATE POLICY "Shop owners view orders for their shops"
ON public.customer_orders
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'merchant'::public.app_role)
  AND shop_id IS NOT NULL
  AND shop_id IN (
    SELECT id FROM public.shops WHERE created_by = auth.uid()
  )
);
