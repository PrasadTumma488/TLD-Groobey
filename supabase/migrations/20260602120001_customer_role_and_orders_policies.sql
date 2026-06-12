-- Customer self-service profile + order policies (run after customer enum value commits).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_address TEXT;

COMMENT ON COLUMN public.profiles.default_address IS
  'Default delivery address for customer accounts.';

DROP POLICY IF EXISTS "Only Platform Admin can update profiles" ON public.profiles;
CREATE POLICY "Platform admin updates profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'main_admin'::public.app_role));

CREATE POLICY "Customers update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND private.has_role(auth.uid(), 'customer'::public.app_role)
)
WITH CHECK (
  user_id = auth.uid()
  AND private.has_role(auth.uid(), 'customer'::public.app_role)
);

DROP POLICY IF EXISTS "Order takers create own orders" ON public.customer_orders;
CREATE POLICY "Staff and customers create own orders"
ON public.customer_orders
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'order_taker'::public.app_role)
    OR private.has_role(auth.uid(), 'customer'::public.app_role)
    OR private.is_admin_or_main(auth.uid())
  )
);

DROP POLICY IF EXISTS "Order takers view own orders and admins view all" ON public.customer_orders;
CREATE POLICY "Creators and admins view customer orders"
ON public.customer_orders
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
  OR private.has_role(auth.uid(), 'employee'::public.app_role)
  OR private.has_role(auth.uid(), 'merchant'::public.app_role)
);

DROP POLICY IF EXISTS "Order takers update own orders and admins update all" ON public.customer_orders;
CREATE POLICY "Creators and admins update customer orders"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
);
