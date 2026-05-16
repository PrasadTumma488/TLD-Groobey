-- Default sale quantity per catalog row (from Excel "qty" column or manual entry).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_quantity numeric(12, 3) NOT NULL DEFAULT 1;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_default_quantity_positive;
ALTER TABLE public.products
  ADD CONSTRAINT products_default_quantity_positive CHECK (default_quantity > 0);
