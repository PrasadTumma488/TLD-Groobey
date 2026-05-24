import { supabase } from "@/integrations/supabase/client";

/** Groobey margin as percent of retail (0–100). Example: 8 → trade is 92% of retail. */
export function clampMarginPercent(raw: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function tradeMultiplierFromMarginPercent(marginPct: number): number {
  return (100 - clampMarginPercent(marginPct)) / 100;
}

/** Per-unit trade from retail, rounded to paise. */
export function tradeUnitFromRetail(retail: number, marginPct: number): number {
  const r = Number(retail) || 0;
  const t = r * tradeMultiplierFromMarginPercent(marginPct);
  return Math.round(t * 100) / 100;
}

/** Order or bill total after margin (retail is customer-facing total). */
export function tradeAmountFromRetail(retail: number, marginPct: number): number {
  return tradeUnitFromRetail(retail, marginPct);
}

/** Load latest shop margin from DB (avoids stale dashboard state after admin updates). */
export async function fetchShopTradeMarginPercent(shopId: string): Promise<number> {
  const { data, error } = await supabase
    .from("shops")
    .select("trade_margin_percent")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return clampMarginPercent(Number(data?.trade_margin_percent ?? 0));
}

export function schemaSetupHint(errorMessage: string): string | null {
  if (!/does not exist/i.test(errorMessage)) return null;
  if (
    errorMessage.includes("trade_margin_percent") ||
    errorMessage.includes("trade_margin_percent_applied") ||
    errorMessage.includes("merchant_settlement_amount") ||
    errorMessage.includes("bill_number") ||
    errorMessage.includes("product_unit") ||
    errorMessage.includes("grocery_subtotal") ||
    errorMessage.includes("delivery_charge") ||
    errorMessage.includes("assigned_delivery_user_id")
  ) {
    return `${errorMessage} - Apply database updates: open Supabase → SQL Editor → run the file supabase/scripts/apply_pending_schema.sql (or run supabase db push).`;
  }
  return null;
}
