-- Personal member shop URL: /my/:shop_slug
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_shop_slug_unique
  ON public.profiles (shop_slug)
  WHERE shop_slug IS NOT NULL;

COMMENT ON COLUMN public.profiles.shop_slug IS 'Public URL slug for the member grocery dashboard (/my/:slug).';
