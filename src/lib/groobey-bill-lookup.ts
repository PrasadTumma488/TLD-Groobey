import type { Database } from "@/integrations/supabase/types";
import { displayBillId } from "@/lib/groobey-bill-id";

export type CustomerOrderRow = Database["public"]["Tables"]["customer_orders"]["Row"];

export function normalizeBillIdInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/** Comparable forms for matching (with/without prefix, dashes). */
export function billIdComparableForms(billNumber: string): string[] {
  const n = normalizeBillIdInput(billNumber);
  const forms = new Set<string>([n, n.replace(/-/g, "")]);
  const daily = n.match(/^(\d{6})-(\d+)$/);
  if (daily) {
    const [, day, seq] = daily;
    forms.add(`${day}${seq}`);
    forms.add(seq);
  }
  for (const p of ["GCO", "GB", "GBS"] as const) {
    if (n.startsWith(`${p}-`)) {
      const tail = n.slice(p.length + 1);
      forms.add(tail);
      forms.add(tail.replace(/-/g, ""));
    }
  }
  const compact = n.replace(/-/g, "");
  const compactMatch = compact.match(/^(GCO|GBS|GB)(\d{4})(\d+)$/);
  if (compactMatch) {
    const [, prefix, period, seq] = compactMatch;
    forms.add(`${prefix}-${period}-${seq}`);
  }
  return [...forms];
}

function queryComparableForms(query: string): string[] {
  const q = normalizeBillIdInput(query);
  const forms = new Set<string>([q, q.replace(/-/g, "")]);
  if (/^\d+$/.test(q)) forms.add(q);
  const daily = q.match(/^(\d{6})-?(\d+)$/);
  if (daily) {
    forms.add(`${daily[1]}-${daily[2]}`);
    forms.add(`${daily[1]}${daily[2]}`);
    forms.add(daily[2]);
  }
  const compactMatch = q.replace(/-/g, "").match(/^(GCO|GBS|GB)?(\d{4})?(\d+)$/);
  if (compactMatch) {
    const [, prefix, period, seq] = compactMatch;
    if (prefix && period && seq) forms.add(`${prefix}-${period}-${seq}`);
    if (period && seq) forms.add(`${period}-${seq}`);
  }
  const dailyCompact = q.replace(/-/g, "").match(/^(\d{6})(\d+)$/);
  if (dailyCompact) {
    forms.add(`${dailyCompact[1]}-${dailyCompact[2]}`);
    forms.add(dailyCompact[2]);
  }
  return [...forms];
}

/** Match YYMMDD-NN, legacy GB-* / GCO-* / GBS-*, partial numeric tail, dashless input. */
export function billMatchesQuery(billNumber: string | null | undefined, query: string): boolean {
  const bill = billNumber?.trim();
  if (!bill || !query.trim()) return false;
  const qForms = queryComparableForms(query);
  const bForms = billIdComparableForms(bill);
  for (const q of qForms) {
    for (const b of bForms) {
      if (b === q) return true;
      if (q.length >= 3 && (b.includes(q) || q.includes(b))) return true;
      if (/^\d+$/.test(q)) {
        const bDigits = b.replace(/\D/g, "");
        if (b.endsWith(q) || bDigits.endsWith(q)) return true;
      }
    }
  }
  return false;
}

export function findOrderByBillQuery(
  orders: CustomerOrderRow[],
  query: string,
): CustomerOrderRow | null {
  const q = normalizeBillIdInput(query);
  if (!q) return null;
  return (
    orders.find((o) => o.bill_number?.trim() && billMatchesQuery(o.bill_number, q)) ?? null
  );
}

export function filterOrdersForBillSearch(
  orders: CustomerOrderRow[],
  query: string,
): CustomerOrderRow[] {
  const q = normalizeBillIdInput(query);
  if (!q) return orders.filter((o) => o.bill_number?.trim());
  return orders.filter((o) => o.bill_number?.trim() && billMatchesQuery(o.bill_number, q));
}

export function billOrderLabel(order: CustomerOrderRow): string {
  const bill = displayBillId(order.bill_number, "No bill ID");
  const name = order.customer_name?.trim() || "Customer";
  const total = Math.round(Number(order.total_amount || 0));
  return `${bill} · ${name} · ₹${total}`;
}

export function ordersWithBillNumbers(orders: CustomerOrderRow[]): CustomerOrderRow[] {
  return orders.filter((o) => Boolean(o.bill_number?.trim()));
}

export function sortOrdersNewestFirst(orders: CustomerOrderRow[]): CustomerOrderRow[] {
  return [...orders].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );
}

/** Orders that appear in the Bill ID dropdown (newest first, must have a bill_number). */
export function ordersForBillPicker(orders: CustomerOrderRow[]): CustomerOrderRow[] {
  return sortOrdersNewestFirst(ordersWithBillNumbers(orders));
}

/** All orders newest-first (list panel, counts). */
export function allOrdersNewestFirst(orders: CustomerOrderRow[]): CustomerOrderRow[] {
  return sortOrdersNewestFirst(orders);
}

export function billPickerLabel(order: CustomerOrderRow): string {
  const bill = order.bill_number?.trim();
  const name = order.customer_name?.trim() || "Customer";
  const total = Math.round(Number(order.total_amount || 0));
  if (bill) return `${bill} · ${name} · ₹${total}`;
  return `Assigning bill ID… · ${name} · ₹${total}`;
}

/** @deprecated use filterOrdersForBillSearch */
export function filterOrdersByBillQuery(
  orders: CustomerOrderRow[],
  query: string,
): CustomerOrderRow[] {
  return filterOrdersForBillSearch(orders, query);
}
