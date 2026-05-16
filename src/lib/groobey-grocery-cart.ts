import type { Database } from "@/integrations/supabase/types";
import { defaultQuantityForProduct } from "@/lib/groobey-product-catalog";

export type GroceryProduct = Database["public"]["Tables"]["products"]["Row"];

export type GroceryCartLine = {
  productId: string;
  quantity: number;
};

export function groceryCartLineTotal(product: GroceryProduct, quantity: number): number {
  return Math.round(Number(product.price || 0) * quantity);
}

export function groceryCartRetailTotal(
  lines: GroceryCartLine[],
  products: GroceryProduct[],
): number {
  return lines.reduce((sum, row) => {
    const product = products.find((p) => p.id === row.productId);
    if (!product) return sum;
    return sum + groceryCartLineTotal(product, row.quantity);
  }, 0);
}

/** Text stored on customer_orders.order_items (same style as staff delivery notes). */
export function groceryCartSummaryText(
  lines: GroceryCartLine[],
  products: GroceryProduct[],
): string {
  return lines
    .map((row) => {
      const product = products.find((p) => p.id === row.productId);
      if (!product) return null;
      const lineTotal = groceryCartLineTotal(product, row.quantity);
      return `${product.name} (${product.unit}) × ${row.quantity} @ ₹${product.price} = ₹${lineTotal}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function defaultQtyForProduct(product: GroceryProduct | undefined): number {
  return product ? defaultQuantityForProduct(product) : 1;
}
