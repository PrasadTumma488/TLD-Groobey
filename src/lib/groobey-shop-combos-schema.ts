export const SHOP_COMBOS_SCHEMA_ERROR =
  "Could not find the table 'public.shop_combos' in the schema cache";

export function isShopCombosSchemaError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /shop_combos/i.test(message) && /schema cache|does not exist|Could not find the table/i.test(message);
}
