import type { Database } from "@/integrations/supabase/types";

type Sale = Database["public"]["Tables"]["sales"]["Row"];

function toDate(value: string | null | undefined) {
  const d = new Date(value || 0);
  return Number.isFinite(d.getTime()) ? d : new Date(0);
}

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

/** Primary label for a sale: YYMMDD-NN Bill ID when assigned, else legacy day sequence. */
export function saleDisplayId(sale: Sale, allSales: Sale[]) {
  const bill = sale.bill_number?.trim();
  if (bill) return bill;

  const ts = toDate(sale.sold_at || sale.created_at);
  const yy = pad(ts.getUTCFullYear() % 100, 2);
  const mm = pad(ts.getUTCMonth() + 1, 2);
  const dd = pad(ts.getUTCDate(), 2);
  const dayKey = `${yy}/${mm}/${dd}`;

  const sameDay = allSales
    .filter((s) => {
      const d = toDate(s.sold_at || s.created_at);
      return (
        d.getUTCFullYear() === ts.getUTCFullYear() &&
        d.getUTCMonth() === ts.getUTCMonth() &&
        d.getUTCDate() === ts.getUTCDate()
      );
    })
    .sort((a, b) => {
      const aTime = toDate(a.sold_at || a.created_at).getTime();
      const bTime = toDate(b.sold_at || b.created_at).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return a.id.localeCompare(b.id);
    });

  const idx = sameDay.findIndex((s) => s.id === sale.id);
  const seq = idx >= 0 ? idx + 1 : 1;
  return `${dayKey}-${pad(seq, 3)}`;
}

export function saleDisplayTime(sale: Sale) {
  const ts = toDate(sale.sold_at || sale.created_at);
  const day = ts.toLocaleDateString(undefined, { weekday: "long" });
  const time = ts.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${time}`;
}
