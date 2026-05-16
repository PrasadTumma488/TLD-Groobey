import { allocateCustomerOrderBillNumber, allocateSaleBillNumber, asBillRpcClient } from "@/lib/groobey-bill-id";
import type { CustomerOrderRow } from "@/lib/groobey-bill-lookup";
import type { Database } from "@/integrations/supabase/types";

type SaleRow = Database["public"]["Tables"]["sales"]["Row"];

type SupabaseLike = {
  rpc: (
    fn: string,
    args?: Record<string, never>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export type BillBackfillResult = { count: number; error: string | null };

function isMissingRpc(message: string, fn: string): boolean {
  return message.toLowerCase().includes(fn.toLowerCase());
}

/** Server backfill via migration RPC (preferred). */
export async function backfillMyCustomerOrderBillIds(
  client: SupabaseLike,
  missingOrders: CustomerOrderRow[],
): Promise<BillBackfillResult> {
  const res = await client.rpc("backfill_my_customer_order_bill_ids");
  if (res.error) {
    if (!isMissingRpc(res.error.message, "backfill_my_customer_order_bill_ids")) {
      return { count: 0, error: res.error.message };
    }
    return backfillCustomerOrdersClient(client, missingOrders);
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  if (rows.length > 0) return { count: rows.length, error: null };
  return backfillCustomerOrdersClient(client, missingOrders);
}

/** Client fallback: assign YYMMDD-NN per order missing bill_number. */
export async function backfillCustomerOrdersClient(
  client: SupabaseLike,
  orders: CustomerOrderRow[],
): Promise<BillBackfillResult> {
  let count = 0;
  for (const order of orders) {
    if (order.bill_number?.trim()) continue;
    const { billNo, error } = await allocateCustomerOrderBillNumber(asBillRpcClient(client));
    if (error) return { count, error: error.message };
    if (!billNo) continue;
    const upd = await client
      .from("customer_orders")
      .update({ bill_number: billNo })
      .eq("id", order.id);
    if (upd.error) return { count, error: upd.error.message };
    count += 1;
  }
  return { count, error: null };
}

export function ordersMissingBillId(orders: CustomerOrderRow[]): CustomerOrderRow[] {
  return orders.filter((o) => !o.bill_number?.trim());
}

export function salesMissingBillId(sales: SaleRow[]): SaleRow[] {
  return sales.filter((s) => !s.bill_number?.trim());
}

export async function backfillMySaleBillIds(
  client: SupabaseLike,
  missingSales: SaleRow[],
): Promise<BillBackfillResult> {
  const res = await client.rpc("backfill_my_sale_bill_ids");
  if (res.error) {
    if (!isMissingRpc(res.error.message, "backfill_my_sale_bill_ids")) {
      return { count: 0, error: res.error.message };
    }
    return backfillSalesClient(client, missingSales);
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  if (rows.length > 0) return { count: rows.length, error: null };
  return backfillSalesClient(client, missingSales);
}

export async function backfillSalesClient(
  client: SupabaseLike,
  sales: SaleRow[],
): Promise<BillBackfillResult> {
  let count = 0;
  for (const sale of sales) {
    if (sale.bill_number?.trim()) continue;
    const { billNo, error } = await allocateSaleBillNumber(asBillRpcClient(client));
    if (error) return { count, error: error.message };
    if (!billNo) continue;
    const upd = await client.from("sales").update({ bill_number: billNo }).eq("id", sale.id);
    if (upd.error) return { count, error: upd.error.message };
    count += 1;
  }
  return { count, error: null };
}

/** Backfill customer orders then reload caller data if count > 0. */
export async function runCustomerOrderBillBackfill(
  client: SupabaseLike,
  orders: CustomerOrderRow[],
): Promise<BillBackfillResult> {
  const missing = ordersMissingBillId(orders);
  if (!missing.length) return { count: 0, error: null };
  return backfillMyCustomerOrderBillIds(client, missing);
}
