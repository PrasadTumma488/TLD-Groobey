-- Delivery staff: allow confirmed → packed and full handoff chain on assigned orders

DROP POLICY IF EXISTS "Delivery staff update delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff update delivery queue"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee')
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'employee')
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status,
    'delivered'::public.order_status
  )
);
