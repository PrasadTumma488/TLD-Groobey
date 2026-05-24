/** PostgREST select lists for customer_orders (with optional shop_id). */

const CUSTOMER_ORDER_DELIVERY_EXTRA =
  "grocery_subtotal,delivery_charge,delivery_destination,work_from_shop_id,items_delivered_text,delivery_time_slot,assigned_delivery_user_id";

export const CUSTOMER_ORDER_SELECT =
  `id,created_by,shop_id,customer_name,customer_phone,delivery_address,order_items,total_amount,merchant_settlement_amount,bill_number,trade_margin_percent_applied,required_date,notes,status,created_at,${CUSTOMER_ORDER_DELIVERY_EXTRA}`;

export const CUSTOMER_ORDER_SELECT_WITHOUT_DELIVERY_EXTRA =
  "id,created_by,shop_id,customer_name,customer_phone,delivery_address,order_items,total_amount,merchant_settlement_amount,bill_number,trade_margin_percent_applied,required_date,notes,status,created_at";

export const CUSTOMER_ORDER_SELECT_LEGACY =
  "id,created_by,customer_name,customer_phone,delivery_address,order_items,total_amount,merchant_settlement_amount,bill_number,trade_margin_percent_applied,required_date,notes,status,created_at";

const CUSTOMER_ORDER_DELIVERY_CORE =
  "id,bill_number,shop_id,customer_name,customer_phone,delivery_address,order_items,total_amount,grocery_subtotal,delivery_charge,items_delivered_text,delivery_time_slot,notes,status,created_at,assigned_delivery_user_id";

/** Explicit `shop_id` FK - avoids PostgREST ambiguity with work_from_shop_id → shops. */
export const CUSTOMER_ORDER_DELIVERY_SELECT =
  `${CUSTOMER_ORDER_DELIVERY_CORE},shop:shops!shop_id(name)`;

/** Same columns without shop embed (client resolves shop name from shop_id). */
export const CUSTOMER_ORDER_DELIVERY_SELECT_NO_EMBED = CUSTOMER_ORDER_DELIVERY_CORE;

export const CUSTOMER_ORDER_DELIVERY_SELECT_LEGACY =
  "id,bill_number,customer_name,customer_phone,delivery_address,order_items,total_amount,notes,status,created_at";

export function isMissingCustomerOrderShopIdError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("shop_id") && (m.includes("does not exist") || m.includes("could not find"));
}

export function isAmbiguousCustomerOrderShopEmbedError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("more than one relationship") &&
    m.includes("customer_orders") &&
    m.includes("shops")
  );
}

export function notesWithShopFallback(
  shopName: string | undefined,
  notes: string,
): string | null {
  const trimmed = notes.trim();
  if (!shopName?.trim()) return trimmed || null;
  const shopLine = `Shop: ${shopName.trim()}`;
  if (trimmed.startsWith("Shop:")) return trimmed || null;
  return trimmed ? `${shopLine}\n${trimmed}` : shopLine;
}
