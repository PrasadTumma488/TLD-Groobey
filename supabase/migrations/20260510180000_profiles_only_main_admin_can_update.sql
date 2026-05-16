-- Shop owners and staff must not edit their own profile from the app; only Platform Admin manages directory details.
DROP POLICY IF EXISTS "Profiles can be updated by owner or main admin" ON public.profiles;

CREATE POLICY "Only Platform Admin can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'))
WITH CHECK (private.has_role(auth.uid(), 'main_admin'));
