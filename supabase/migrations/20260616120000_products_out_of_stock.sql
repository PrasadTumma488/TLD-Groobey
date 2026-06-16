-- Per-item out of stock: item stays visible in shop but cannot be added to cart.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_out_of_stock IS
  'When true, product remains visible in the customer shop but cannot be added to cart.';

ALTER TABLE public.products REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_products_out_of_stock_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_out_of_stock'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN is_out_of_stock boolean NOT NULL DEFAULT false;
  END IF;

  ALTER TABLE public.products REPLICA IDENTITY FULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_products_out_of_stock_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_products_out_of_stock_schema() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
