import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_GROCERY_PACK } from "@/lib/groobey-pack-sizes";

export type CatalogProduct = Database["public"]["Tables"]["products"]["Row"];

export function productCatalogKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

export function defaultQuantityForProduct(product: Pick<CatalogProduct, "default_quantity">): number {
  const q = Number(product.default_quantity ?? 1);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

/** Label for dropdowns / search: name, pack, price, optional default qty. */
export function formatProductOptionLabel(product: CatalogProduct): string {
  const qty = defaultQuantityForProduct(product);
  const qtyPart = qty !== 1 ? ` · qty ${qty}` : "";
  return `${product.name} · ₹${product.price}/${product.unit}${qtyPart}`;
}

export function filterProductsByQuery(products: CatalogProduct[], query: string): CatalogProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      String(p.price).includes(q),
  );
}

export function normalizeCatalogUnit(raw: string): string {
  const unit = raw.trim();
  return unit || DEFAULT_GROCERY_PACK;
}
