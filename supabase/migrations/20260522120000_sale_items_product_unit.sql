-- Snapshot pack size on each sale line (for bills: qty shows as "2 K", "500 GS", etc.).
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_unit text;

COMMENT ON COLUMN public.sale_items.product_unit IS 'Pack size at sale time (e.g. 1 kg, 500 g).';

UPDATE public.sale_items si
SET product_unit = p.unit
FROM public.products p
WHERE si.product_id = p.id
  AND (si.product_unit IS NULL OR btrim(si.product_unit) = '');
