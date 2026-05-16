DROP POLICY IF EXISTS "Shop owners can insert own shops" ON public.shops;
CREATE POLICY "Shop owners can insert own shops"
ON public.shops
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Shop owners can update own shops" ON public.shops;
CREATE POLICY "Shop owners can update own shops"
ON public.shops
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
