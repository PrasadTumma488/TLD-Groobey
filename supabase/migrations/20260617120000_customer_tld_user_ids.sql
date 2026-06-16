-- Customer TLD User IDs: TLD-USER-YYMMDD-NN (same date + daily sequence as Bill IDs, Asia/Kolkata).

CREATE OR REPLACE FUNCTION public.groobey_format_tld_user_id(p_day int, p_seq int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'TLD-USER-' || lpad(p_day::text, 6, '0') || '-' || lpad(greatest(p_seq, 1)::text, 2, '0');
$$;

COMMENT ON FUNCTION public.groobey_format_tld_user_id IS
  'Shopper id e.g. TLD-USER-260608-01 (IST calendar day + daily signup sequence).';

CREATE OR REPLACE FUNCTION public.assign_customer_tld_user_id(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created timestamptz;
  v_day int;
  v_seq int;
  v_code text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'customer'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Not a customer account';
  END IF;

  SELECT groobey_code, created_at
  INTO v_code, v_created
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_code IS NOT NULL AND v_code ~* '^TLD-USER-[0-9]{6}-[0-9]+$' THEN
    RETURN v_code;
  END IF;

  IF v_created IS NULL THEN
    v_created := timezone('utc', now());
  END IF;

  v_day := public.groobey_bill_day_ist(v_created);

  SELECT count(*)::int + 1
  INTO v_seq
  FROM public.profiles p
  INNER JOIN public.user_roles ur
    ON ur.user_id = p.user_id AND ur.role = 'customer'::public.app_role
  WHERE public.groobey_bill_day_ist(p.created_at) = v_day
    AND (
      p.created_at < v_created
      OR (p.created_at = v_created AND p.user_id::text < p_user_id::text)
    );

  v_code := public.groobey_format_tld_user_id(v_day, v_seq);

  UPDATE public.profiles
  SET groobey_code = v_code
  WHERE user_id = p_user_id;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_customer_tld_user_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_customer_tld_user_id(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_customer_tld_user_id IS
  'Assigns TLD-USER-YYMMDD-NN based on signup date (IST) and daily customer sequence.';

-- Backfill existing shoppers (replace staff DB codes and missing ids).
WITH ranked AS (
  SELECT
    p.user_id,
    public.groobey_bill_day_ist(p.created_at) AS bill_day,
    row_number() OVER (
      PARTITION BY public.groobey_bill_day_ist(p.created_at)
      ORDER BY p.created_at, p.user_id
    ) AS seq
  FROM public.profiles p
  INNER JOIN public.user_roles ur
    ON ur.user_id = p.user_id AND ur.role = 'customer'::public.app_role
)
UPDATE public.profiles p
SET groobey_code = public.groobey_format_tld_user_id(r.bill_day, r.seq::int)
FROM ranked r
WHERE p.user_id = r.user_id
  AND (
    p.groobey_code IS NULL
    OR p.groobey_code !~* '^TLD-USER-[0-9]{6}-[0-9]+$'
  );

-- Assign id on customer self-registration.
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

  PERFORM public.assign_customer_tld_user_id(v_uid);
END;
$$;
