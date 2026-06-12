-- Lets customers finish registration without the server service-role key.
-- Called immediately after auth.signUp while the new session is active.

CREATE OR REPLACE FUNCTION public.register_customer_self(
  p_display_name text,
  p_email text,
  p_phone text,
  p_default_address text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_assignment record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(coalesce(p_display_name, '')) = '' THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  INSERT INTO public.profiles (
    user_id,
    display_name,
    email,
    phone,
    default_address,
    is_active
  )
  VALUES (
    v_uid,
    trim(p_display_name),
    v_email,
    nullif(trim(p_phone), ''),
    nullif(trim(p_default_address), ''),
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    default_address = EXCLUDED.default_address,
    is_active = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'customer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  FOR v_assignment IN
    SELECT role, display_name
    FROM public.staff_email_assignments
    WHERE email = v_email
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, v_assignment.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    IF v_assignment.display_name IS NOT NULL AND trim(v_assignment.display_name) <> '' THEN
      UPDATE public.profiles
      SET display_name = coalesce(nullif(trim(display_name), ''), trim(v_assignment.display_name))
      WHERE user_id = v_uid;
    END IF;
  END LOOP;

  DELETE FROM public.staff_email_assignments
  WHERE email = v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_self(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_self(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.register_customer_self IS
  'Creates profile + customer role (and pending staff roles) for the signed-in user after public sign-up.';
