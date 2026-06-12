import type { Database } from "@/integrations/supabase/types";
import { displayBillId } from "@/lib/groobey-bill-id";

type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];

/** Customer-facing bill label — never shows "Pending". */
export function customerOrderBillLabel(order: Pick<CustomerOrder, "bill_number" | "id" | "created_at">): string {
  const bill = displayBillId(order.bill_number, "");
  if (bill) return bill;

  const when = order.created_at ? new Date(order.created_at) : null;
  if (when && !Number.isNaN(when.getTime())) {
    const yy = String(when.getFullYear()).slice(-2);
    const mm = String(when.getMonth() + 1).padStart(2, "0");
    const dd = String(when.getDate()).padStart(2, "0");
    const tail = order.id.replace(/-/g, "").slice(0, 4).toUpperCase();
    return `${yy}${mm}${dd}-${tail}`;
  }

  return `Order ${order.id.slice(0, 8)}`;
}
