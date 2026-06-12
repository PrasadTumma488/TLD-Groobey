-- Guest shop: anon can browse active catalog. Customers keep 15 days of order history.

CREATE POLICY "Anyone can view active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Anyone can view active shops"
ON public.shops
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Soft-delete this user's orders older than N days (called when they open shop / history).
CREATE OR REPLACE FUNCTION public.purge_my_old_customer_orders(p_days int DEFAULT 15)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF p_days < 1 THEN
    p_days := 15;
  END IF;

  UPDATE public.customer_orders
  SET deleted_at = now()
  WHERE created_by = auth.uid()
    AND deleted_at IS NULL
    AND created_at < (now() - make_interval(days => p_days));
END;
$$;

REVOKE ALL ON FUNCTION public.purge_my_old_customer_orders(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_my_old_customer_orders(int) TO authenticated;

COMMENT ON FUNCTION public.purge_my_old_customer_orders IS
  'Soft-deletes customer orders older than p_days for the signed-in user (default 15).';
