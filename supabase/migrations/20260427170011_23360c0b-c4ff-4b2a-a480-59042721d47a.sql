CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.has_role(UUID, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_admin_or_main(UUID) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_admin_or_main(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Update role policies to reference private helpers explicitly where needed
DROP POLICY IF EXISTS "Profiles can be viewed by owner or admins" ON public.profiles;
CREATE POLICY "Profiles can be viewed by owner or admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Profiles can be updated by owner or main admin" ON public.profiles;
CREATE POLICY "Profiles can be updated by owner or main admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'main_admin'))
WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Users can view their own roles and admins can view all roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles and admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Only main admins can manage roles" ON public.user_roles;
CREATE POLICY "Only main admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'))
WITH CHECK (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Authenticated staff can view active products" ON public.products;
CREATE POLICY "Authenticated staff can view active products"
ON public.products
FOR SELECT
TO authenticated
USING (is_active = true OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Only main admins can create products" ON public.products;
CREATE POLICY "Only main admins can create products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Only main admins can update products" ON public.products;
CREATE POLICY "Only main admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'))
WITH CHECK (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Only main admins can delete products" ON public.products;
CREATE POLICY "Only main admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Authenticated staff can view active shops" ON public.shops;
CREATE POLICY "Authenticated staff can view active shops"
ON public.shops
FOR SELECT
TO authenticated
USING (is_active = true OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage shops" ON public.shops;
CREATE POLICY "Admins can manage shops"
ON public.shops
FOR ALL
TO authenticated
USING (private.is_admin_or_main(auth.uid()))
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Staff can view their own sales and admins can view all sales" ON public.sales;
CREATE POLICY "Staff can view their own sales and admins can view all sales"
ON public.sales
FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can update sales for verification" ON public.sales;
CREATE POLICY "Admins can update sales for verification"
ON public.sales
FOR UPDATE
TO authenticated
USING (private.is_admin_or_main(auth.uid()))
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Only main admins can delete sales" ON public.sales;
CREATE POLICY "Only main admins can delete sales"
ON public.sales
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Sale items follow sale visibility" ON public.sale_items;
CREATE POLICY "Sale items follow sale visibility"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
      AND (sales.created_by = auth.uid() OR private.is_admin_or_main(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Admins can update sale items" ON public.sale_items;
CREATE POLICY "Admins can update sale items"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (private.is_admin_or_main(auth.uid()))
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete sale items" ON public.sale_items;
CREATE POLICY "Admins can delete sale items"
ON public.sale_items
FOR DELETE
TO authenticated
USING (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Workers can view own attendance and admins can view all attendance" ON public.attendance;
CREATE POLICY "Workers can view own attendance and admins can view all attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (worker_id = auth.uid() OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can verify attendance" ON public.attendance;
CREATE POLICY "Admins can verify attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (private.is_admin_or_main(auth.uid()))
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Only main admins can delete attendance" ON public.attendance;
CREATE POLICY "Only main admins can delete attendance"
ON public.attendance
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'));