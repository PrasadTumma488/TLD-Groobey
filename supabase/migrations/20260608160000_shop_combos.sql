-- Shop combo packs: admin-managed cards with images, visible in customer shop.
-- Idempotent: safe to re-run from db:push or admin "Set up combo packs".

CREATE TABLE IF NOT EXISTS public.shop_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_combos_price_nonnegative CHECK (price >= 0)
);

ALTER TABLE public.shop_combos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_shop_combos_updated_at ON public.shop_combos;
CREATE TRIGGER update_shop_combos_updated_at
BEFORE UPDATE ON public.shop_combos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Anyone can view active shop combos" ON public.shop_combos;
CREATE POLICY "Anyone can view active shop combos"
ON public.shop_combos
FOR SELECT
TO anon, authenticated
USING (is_active = true OR private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can create shop combos" ON public.shop_combos;
CREATE POLICY "Admins can create shop combos"
ON public.shop_combos
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can update shop combos" ON public.shop_combos;
CREATE POLICY "Admins can update shop combos"
ON public.shop_combos
FOR UPDATE
TO authenticated
USING (private.is_admin_or_main(auth.uid()))
WITH CHECK (private.is_admin_or_main(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete shop combos" ON public.shop_combos;
CREATE POLICY "Admins can delete shop combos"
ON public.shop_combos
FOR DELETE
TO authenticated
USING (private.is_admin_or_main(auth.uid()));

ALTER TABLE public.shop_combos REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shop_combos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_combos;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-combo-images',
  'shop-combo-images',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can view combo images" ON storage.objects;
CREATE POLICY "Anyone can view combo images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'shop-combo-images');

DROP POLICY IF EXISTS "Admins can upload combo images" ON storage.objects;
CREATE POLICY "Admins can upload combo images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shop-combo-images'
  AND private.is_admin_or_main(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update combo images" ON storage.objects;
CREATE POLICY "Admins can update combo images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shop-combo-images'
  AND private.is_admin_or_main(auth.uid())
)
WITH CHECK (
  bucket_id = 'shop-combo-images'
  AND private.is_admin_or_main(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete combo images" ON storage.objects;
CREATE POLICY "Admins can delete combo images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shop-combo-images'
  AND private.is_admin_or_main(auth.uid())
);

COMMENT ON TABLE public.shop_combos IS
  'Customer-facing combo/deal packs with optional image, managed from admin catalog.';

CREATE OR REPLACE FUNCTION public.ensure_shop_combos_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.shop_combos') IS NULL THEN
    RAISE EXCEPTION 'shop_combos table missing. Run npm run db:push or apply_pending_schema shop_combos section.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_shop_combos_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_shop_combos_schema() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
