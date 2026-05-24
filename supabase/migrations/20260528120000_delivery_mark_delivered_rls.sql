-- Delivery staff: read delivered rows (monthly bills) and mark assigned orders delivered without RLS failures.

DROP POLICY IF EXISTS "Delivery staff view delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff view delivery queue"
ON public.customer_orders
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status,
    'delivered'::public.order_status
  )
);

DROP POLICY IF EXISTS "Delivery staff update delivery queue" ON public.customer_orders;
CREATE POLICY "Delivery staff update delivery queue"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND assigned_delivery_user_id = auth.uid()
  AND status IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status,
    'delivered'::public.order_status
  )
);

-- Reliable status updates for assigned delivery queue (avoids RLS edge cases on direct UPDATE).
CREATE OR REPLACE FUNCTION public.mark_assigned_order_status(
  p_order_id uuid,
  p_status public.order_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur public.order_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF NOT private.has_role(auth.uid(), 'employee'::public.app_role) THEN
    RAISE EXCEPTION 'Only delivery staff can update delivery status';
  END IF;

  IF p_status NOT IN (
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status,
    'delivered'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Invalid delivery status: %', p_status;
  END IF;

  SELECT o.status
  INTO cur
  FROM public.customer_orders o
  WHERE o.id = p_order_id
    AND o.assigned_delivery_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not assigned to you. Ask Platform Admin to assign this order in Sales → Order taker bills.';
  END IF;

  IF p_status = 'packed' AND cur NOT IN ('confirmed'::public.order_status) THEN
    RAISE EXCEPTION 'Can only mark Packed from Confirmed (current: %).', cur;
  END IF;

  IF p_status = 'out_for_delivery' AND cur NOT IN (
    'confirmed'::public.order_status,
    'packed'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Can only mark Out for delivery from Confirmed or Packed (current: %).', cur;
  END IF;

  IF p_status = 'delivered' AND cur NOT IN (
    'packed'::public.order_status,
    'out_for_delivery'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Can only mark Delivered from Packed or Out for delivery (current: %).', cur;
  END IF;

  UPDATE public.customer_orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_assigned_order_status(uuid, public.order_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_assigned_order_status(uuid, public.order_status) TO authenticated;
