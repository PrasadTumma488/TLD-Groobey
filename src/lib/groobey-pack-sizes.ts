/** Standard pack / weight options for grocery items (stored in `products.unit`). */
function buildGroceryPackSizes(): ReadonlyArray<{ value: string; label: string }> {
  const grams: { value: string; label: string }[] = [
    { value: "100 g", label: "100 g" },
    { value: "250 g", label: "250 g" },
    { value: "500 g", label: "500 g" },
    { value: "1 kg", label: "1 kg" },
  ];
  const kg: { value: string; label: string }[] = [];
  for (let i = 3; i <= 20; i++) {
    const w = i / 2;
    const label = `${w} kg`;
    kg.push({ value: label, label });
  }
  return [...grams, ...kg];
}

export const GROCERY_PACK_SIZES = buildGroceryPackSizes();

export const DEFAULT_GROCERY_PACK = "1 kg";

/** Single default for DB / legacy rows; not shown in owner UI. */
export const GROCERY_LIST_CATEGORY = "Grocery";

export function isKnownPackSize(unit: string): boolean {
  return GROCERY_PACK_SIZES.some((o) => o.value === unit);
}
