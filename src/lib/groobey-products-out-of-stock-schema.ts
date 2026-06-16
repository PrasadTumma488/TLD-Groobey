export const PRODUCTS_OUT_OF_STOCK_SCHEMA_ERROR =
  "column products.is_out_of_stock does not exist";

export const SUPABASE_SQL_EDITOR_URL =
  "https://supabase.com/dashboard/project/idhgenxhczbgddihdlid/sql/new";

/** Paste once in Supabase SQL Editor — enables out-of-stock toggles. */
export const PRODUCTS_OUT_OF_STOCK_SETUP_SQL = `ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean NOT NULL DEFAULT false;

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
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_products_out_of_stock_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_products_out_of_stock_schema() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';`;

export function isProductsOutOfStockSchemaError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /is_out_of_stock/i.test(message) && /does not exist|schema cache|Could not find/i.test(message);
}

/** Normalize product rows when the column is missing (defaults to in stock). */
export function normalizeProductRow<T extends { is_out_of_stock?: boolean | null }>(
  row: T,
): T & { is_out_of_stock: boolean } {
  return {
    ...row,
    is_out_of_stock: Boolean(row.is_out_of_stock),
  };
}
