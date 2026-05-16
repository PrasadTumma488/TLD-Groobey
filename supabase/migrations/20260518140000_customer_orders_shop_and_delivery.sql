-- Shop routing on customer orders + delivery staff queue access

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_shop_id ON public.customer_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_delivery_queue
  ON public.customer_orders(status, created_at DESC)
  WHERE status IN ('confirmed', 'packed', 'out_for_delivery');

COMMENT ON COLUMN public.customer_orders.shop_id IS
  'Shop that will fulfill / deliver this customer order.';

-- Order takers: cannot mark orders as delivered (delivery staff only)
DROP POLICY IF EXISTS "Order takers update own orders and admins update all" ON public.customer_orders;

CREATE POLICY "Order takers update own orders and admins update all"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
)
WITH CHECK (
  private.is_admin_or_main(auth.uid())
  OR (
    created_by = auth.uid()
    AND (
      NOT private.has_role(auth.uid(), 'order_taker')
      OR status IS DISTINCT FROM 'delivered'::public.order_status
    )
  )
);

-- Delivery staff: view orders ready for handoff / delivery
DROP POLICY IF EXISTS "Delivery staff view delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff view delivery queue"
ON public.customer_orders
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee')
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  )
);

-- Delivery staff: advance packed / out_for_delivery → delivered
DROP POLICY IF EXISTS "Delivery staff update delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff update delivery queue"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee')
  AND status IN (
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'employee')
  AND status IN (
    'delivered'::public.order_status,
    'out_for_delivery'::public.order_status
  )
);
