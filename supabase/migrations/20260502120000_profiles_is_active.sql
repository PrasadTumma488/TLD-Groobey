-- Staff activation flag for owner-managed accounts (login blocked when false)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.is_active IS 'When false, staff cannot use the app (owner-controlled).';
