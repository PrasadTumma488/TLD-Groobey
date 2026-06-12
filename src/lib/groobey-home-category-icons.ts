import { Apple, Carrot, Cookie, Salad, ShoppingBasket, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const HOME_CATEGORY_ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingBasket,
  vegetables: Carrot,
  fruits: Apple,
  "pickles-non-veg": UtensilsCrossed,
  "papads-crisps": Cookie,
  "veg-non-veg": Salad,
};

export function homeCategoryIcon(categoryId: string): LucideIcon {
  return HOME_CATEGORY_ICONS[categoryId] ?? ShoppingBasket;
}
