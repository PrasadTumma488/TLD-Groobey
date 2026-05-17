-- Delivery charge, assignment, and order-taker delivery metadata on customer orders

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS grocery_subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_destination text,
  ADD COLUMN IF NOT EXISTS work_from_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS items_delivered_text text,
  ADD COLUMN IF NOT EXISTS delivery_time_slot text,
  ADD COLUMN IF NOT EXISTS assigned_delivery_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.customer_orders.grocery_subtotal IS 'Sum of grocery lines before delivery charge.';
COMMENT ON COLUMN public.customer_orders.delivery_charge IS 'Delivery fee added to customer bill (₹).';
COMMENT ON COLUMN public.customer_orders.assigned_delivery_user_id IS 'Delivery boy assigned by platform admin.';

UPDATE public.customer_orders
SET grocery_subtotal = COALESCE(total_amount, 0)
WHERE grocery_subtotal = 0 AND COALESCE(total_amount, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_customer_orders_assigned_delivery
  ON public.customer_orders(assigned_delivery_user_id)
  WHERE assigned_delivery_user_id IS NOT NULL;

-- Delivery staff: only orders assigned to them
DROP POLICY IF EXISTS "Delivery staff view delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff view delivery queue"
ON public.customer_orders
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee')
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  )
);

DROP POLICY IF EXISTS "Delivery staff update delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff update delivery queue"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee')
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'employee')
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'delivered'::public.order_status,
    'out_for_delivery'::public.order_status
  )
);
