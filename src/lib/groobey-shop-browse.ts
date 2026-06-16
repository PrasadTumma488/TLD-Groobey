import type { HomeCategory } from "@/lib/groobey-home-categories";
import { HOME_CATEGORIES } from "@/lib/groobey-home-categories";
import { isValidHomeCategoryId } from "@/lib/groobey-home-category-filter";

export const SHOP_COMBOS_CATEGORY_ID = "combos";
/** @deprecated legacy URL param; use category=combos */
export const SHOP_BROWSE_VIEW_ITEMS = "items";
/** @deprecated legacy URL param; use category=combos */
export const SHOP_BROWSE_VIEW_COMBOS = "combos";

export type ShopBrowseView = typeof SHOP_BROWSE_VIEW_ITEMS | typeof SHOP_BROWSE_VIEW_COMBOS;

export const SHOP_COMBOS_TILE = {
  id: SHOP_COMBOS_CATEGORY_ID,
  label: "Combos",
  subtitle: "Value packs & deals",
  image: "/home-categories/combos.png",
} as const;

export function isCombosBrowseCategory(id: string | null | undefined): boolean {
  return id === SHOP_COMBOS_CATEGORY_ID;
}

export function isValidProductCategoryId(id: string | null | undefined): id is string {
  if (!id) return false;
  if (id === "all") return true;
  if (id === SHOP_COMBOS_CATEGORY_ID) return true;
  return isValidHomeCategoryId(id);
}

/** All shop category tiles — product categories first, Combos last (customer shop + admin catalog). */
export function shopBrowseCategories(): HomeCategory[] {
  const combos: HomeCategory = {
    id: SHOP_COMBOS_TILE.id,
    label: SHOP_COMBOS_TILE.label,
    subtitle: SHOP_COMBOS_TILE.subtitle,
    image: SHOP_COMBOS_TILE.image,
  };
  return [...HOME_CATEGORIES, combos];
}

export function categoryMeta(categoryId: string): {
  id: string;
  label: string;
  subtitle: string;
} {
  if (categoryId === "all") return { id: "all", label: "All categories", subtitle: "" };
  if (categoryId === SHOP_COMBOS_CATEGORY_ID) return SHOP_COMBOS_TILE;
  return HOME_CATEGORIES.find((cat) => cat.id === categoryId) ?? HOME_CATEGORIES[0];
}

/** Split combo description into display lines (bullets, commas, new lines). */
export function parseComboItems(description: string | null | undefined): string[] {
  if (!description?.trim()) return [];
  return description
    .split(/\r?\n+|(?:\s*•\s*)|(?:\s*·\s*)|(?:\s*\|\s*)|(?:\s*;\s*)/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

/** @deprecated use category=combos */
export function parseShopBrowseView(value: string | null | undefined): ShopBrowseView {
  if (value === SHOP_BROWSE_VIEW_COMBOS || value === SHOP_COMBOS_CATEGORY_ID) {
    return SHOP_BROWSE_VIEW_COMBOS;
  }
  return SHOP_BROWSE_VIEW_ITEMS;
}

export function normalizeShopCategoryParam(
  category: string | null | undefined,
  view?: string | null | undefined,
): string {
  if (view === SHOP_BROWSE_VIEW_COMBOS || isCombosBrowseCategory(category)) {
    return SHOP_COMBOS_CATEGORY_ID;
  }
  if (isValidProductCategoryId(category)) return category;
  return "all";
}

/** @deprecated use isValidProductCategoryId */
export function isValidShopBrowseCategory(id: string | null | undefined): id is string {
  return isValidProductCategoryId(id);
}
