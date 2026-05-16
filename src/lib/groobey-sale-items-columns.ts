/** sale_items column lists — tolerate DB before `product_unit` migration is applied. */

export const SALE_ITEMS_SELECT_LEGACY =
  "id,sale_id,product_id,product_name,quantity,unit_price,merchant_unit_price,created_at";

export const SALE_ITEMS_SELECT_WITH_UNIT = `${SALE_ITEMS_SELECT_LEGACY},product_unit`;

export function isMissingSaleItemsProductUnitError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("product_unit") && m.includes("does not exist");
}

type ProductUnitSource = { id: string; unit: string };

export function enrichSaleItemsWithPackUnit<
  T extends { product_id: string | null; product_unit?: string | null },
>(items: T[], products: readonly ProductUnitSource[]): T[] {
  if (!products.length) return items;
  const unitById = new Map(products.map((p) => [p.id, p.unit]));
  return items.map((item) => {
    const snap = item.product_unit?.trim();
    if (snap) return item;
    const fromCatalog = item.product_id ? unitById.get(item.product_id)?.trim() : "";
    if (!fromCatalog) return item;
    return { ...item, product_unit: fromCatalog };
  });
}

/** Strip `product_unit` from inserts when the column is not migrated yet. */
export function saleItemInsertWithoutPackUnit<T extends { product_unit?: string | null }>(
  row: T,
): Omit<T, "product_unit"> {
  const { product_unit: _omit, ...rest } = row;
  return rest;
}
