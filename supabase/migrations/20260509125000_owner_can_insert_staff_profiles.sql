-- Allow owner (main_admin) to insert profile rows for newly created staff accounts.
-- Needed for server fallback path that creates staff via auth.signUp without service-role key.

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR private.has_role(auth.uid(), 'main_admin')
);
