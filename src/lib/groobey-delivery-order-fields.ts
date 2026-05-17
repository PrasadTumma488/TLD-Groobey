/** Delivery charge options (₹10–₹100 in steps of 10). */
export const DELIVERY_CHARGE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export const DELIVERY_MINUTE_SLOTS = ["00", "10", "20", "30", "40", "50"] as const;

export type DeliveryDestinationKind = "shop" | "self" | "other";

export function deliveryHourOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    const isPm = h >= 12;
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    out.push({ value: String(h), label: `${h12} ${isPm ? "PM" : "AM"}` });
  }
  return out;
}

export function parseDeliveryCharge(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? "0"));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (DELIVERY_CHARGE_OPTIONS.includes(n as (typeof DELIVERY_CHARGE_OPTIONS)[number])) return n;
  return 0;
}

export function parseDeliveryDestination(raw: FormDataEntryValue | null): DeliveryDestinationKind {
  const v = String(raw ?? "shop").trim();
  if (v === "self" || v === "other") return v;
  return "shop";
}

export function buildOrderDeliveryAddress(params: {
  destination: DeliveryDestinationKind;
  shopName?: string | null;
  otherDestination?: string | null;
  customerAddress?: string | null;
}): string | null {
  const { destination, shopName, otherDestination, customerAddress } = params;
  if (destination === "shop") {
    const name = shopName?.trim();
    return name ? `Shop: ${name}` : "Shop delivery";
  }
  if (destination === "self") return "Self pickup";
  const other = otherDestination?.trim() || customerAddress?.trim();
  return other || null;
}

export function parseCustomerOrderDeliveryFromForm(form: FormData) {
  const destination = parseDeliveryDestination(form.get("destination"));
  const workFromShopId = String(form.get("workFromShopId") || "").trim();
  const otherDestination = String(form.get("otherDestination") || "").trim();
  const customerAddress = String(form.get("customerAddress") || "").trim();
  const itemsDelivered = String(form.get("itemsDelivered") || "").trim();
  const deliveryTimeSlot = String(form.get("deliveryTimeSlot") || "").trim();
  const deliveryCharge = parseDeliveryCharge(form.get("deliveryCharge"));

  return {
    destination,
    workFromShopId: destination === "shop" ? workFromShopId || null : null,
    otherDestination: destination === "other" ? otherDestination || null : null,
    customerAddress: customerAddress || null,
    itemsDelivered: itemsDelivered || null,
    deliveryTimeSlot: deliveryTimeSlot || null,
    deliveryCharge,
  };
}

const DELIVERY_COLUMN_MARKERS = [
  "delivery_charge",
  "assigned_delivery_user_id",
  "delivery_destination",
  "grocery_subtotal",
  "items_delivered_text",
  "delivery_time_slot",
  "work_from_shop_id",
] as const;

/** PostgREST / Postgres message when delivery columns are not migrated yet. */
export function isMissingCustomerOrderDeliveryFieldsError(message: string): boolean {
  const m = message.toLowerCase();
  const mentionsDeliveryCol = DELIVERY_COLUMN_MARKERS.some((col) => m.includes(col));
  return (
    mentionsDeliveryCol &&
    (m.includes("does not exist") ||
      m.includes("could not find") ||
      m.includes("unknown column") ||
      m.includes("42703"))
  );
}

export function supabaseErrorMessage(error: { message?: string; details?: string; hint?: string } | null): string {
  if (!error) return "";
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}
