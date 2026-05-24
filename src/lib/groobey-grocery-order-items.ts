/** Parsed line from customer_orders.order_items / groceryCartSummaryText(). */

export type ParsedGroceryOrderItem = {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Present when the segment did not match the standard cart format. */
  raw?: string;
};

const GROCERY_ORDER_ITEM_RE =
  /^(.+?)\s+\(([^)]+)\)\s+×\s+(\d+(?:\.\d+)?)\s+@\s+₹([\d,.]+)\s+=\s+₹([\d,.]+)/u;

function parseInrAmount(value: string): number {
  return Number(value.replace(/,/g, "")) || 0;
}

/** Split semicolon-separated cart summary into structured rows (with raw fallback per segment). */
export function parseGroceryOrderItemsText(
  text: string | null | undefined,
): ParsedGroceryOrderItem[] {
  const trimmed = text?.trim();
  if (!trimmed) return [];

  return trimmed
    .split(/\s*;\s*/u)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = GROCERY_ORDER_ITEM_RE.exec(segment);
      if (!match) {
        return {
          name: segment,
          unit: "",
          quantity: 1,
          unitPrice: 0,
          lineTotal: 0,
          raw: segment,
        };
      }
      return {
        name: match[1].trim(),
        unit: match[2].trim(),
        quantity: Number(match[3]) || 1,
        unitPrice: parseInrAmount(match[4]),
        lineTotal: parseInrAmount(match[5]),
      };
    });
}
