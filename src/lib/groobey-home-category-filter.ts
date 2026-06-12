import type { Database } from "@/integrations/supabase/types";
import { HOME_CATEGORIES } from "@/lib/groobey-home-categories";
import { GROCERY_LIST_CATEGORY } from "@/lib/groobey-pack-sizes";

type Product = Database["public"]["Tables"]["products"]["Row"];

const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  groceries: /grocery|rice|dal|oil|atta|sugar|salt|masala|flour|essential/i,
  vegetables: /vegetable|tomato|onion|potato|carrot|beans|brinjal|chilli|leafy|spinach|cabbage/i,
  fruits: /fruit|apple|banana|mango|grape|orange|papaya|watermelon|pomegranate/i,
  "pickles-non-veg": /pickle|achar|non.?veg pickle/i,
  "papads-crisps": /papad|crisp|chips|snack|fryums/i,
  "veg-non-veg": /chicken|mutton|meat|fish|prawn|egg/i,
};

function haystack(product: Product): string {
  return [product.name, product.category, product.unit].filter(Boolean).join(" ");
}

export function isValidHomeCategoryId(id: string | null | undefined): id is string {
  if (!id) return false;
  return HOME_CATEGORIES.some((c) => c.id === id);
}

export function filterProductsByHomeCategory(
  products: Product[],
  categoryId: string | null | undefined,
): Product[] {
  if (!isValidHomeCategoryId(categoryId)) return products;

  const pattern = CATEGORY_KEYWORDS[categoryId];
  if (!pattern) return products;

  const matched = products.filter((p) => pattern.test(haystack(p)));
  if (matched.length > 0) return matched;

  if (categoryId === "groceries") {
    return products.filter(
      (p) => !p.category?.trim() || p.category.trim() === GROCERY_LIST_CATEGORY,
    );
  }

  return products;
}
