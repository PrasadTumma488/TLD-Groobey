DROP POLICY IF EXISTS "Staff can view their own sales and admins can view all sales" ON public.sales;
CREATE POLICY "Staff can view allowed sales"
ON public.sales
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
  OR (private.has_role(auth.uid(), 'employee') AND status = 'verified')
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
        OR (private.has_role(auth.uid(), 'employee') AND sales.status = 'verified')
      )
  )
);
