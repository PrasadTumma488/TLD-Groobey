import type { Database } from "@/integrations/supabase/types";

export type SaleRow = Database["public"]["Tables"]["sales"]["Row"];

export function isSaleArchived(sale: Pick<SaleRow, "deleted_at">): boolean {
  return sale.deleted_at != null && sale.deleted_at !== "";
}

/** Sales shown in pipeline / merchant cards (not removed). */
export function salesForPipeline<T extends Pick<SaleRow, "deleted_at">>(sales: T[]): T[] {
  return sales.filter((s) => !isSaleArchived(s));
}

/** All sales in a period for today/month totals and monthly settlement (includes archived). */
export function salesForPeriodAnalytics<T extends Pick<SaleRow, "deleted_at" | "sold_at" | "created_at">>(
  sales: T[],
  periodKey: string,
  mode: "day" | "month",
): T[] {
  return sales.filter((s) => {
    const stamp = (s.sold_at || s.created_at || "").slice(0, mode === "day" ? 10 : 7);
    return stamp === periodKey;
  });
}

export function saleCountsForPeriod<T extends Pick<SaleRow, "deleted_at" | "sold_at" | "created_at" | "status">>(
  sales: T[],
  periodKey: string,
  mode: "day" | "month",
): { total: number; verified: number; archived: number } {
  const inPeriod = salesForPeriodAnalytics(sales, periodKey, mode);
  return {
    total: inPeriod.length,
    verified: inPeriod.filter((s) => s.status === "verified").length,
    archived: inPeriod.filter((s) => isSaleArchived(s)).length,
  };
}
