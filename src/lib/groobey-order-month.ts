/** Calendar month key `YYYY-MM` - new month starts a fresh scope automatically. */
export function calendarMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function formatCalendarMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function orderCreatedInMonth(
  order: { created_at?: string | null },
  monthKey: string,
): boolean {
  return (order.created_at || "").slice(0, 7) === monthKey;
}

export function filterOrdersByCalendarMonth<T extends { created_at?: string | null }>(
  orders: T[],
  monthKey: string,
): T[] {
  return orders.filter((o) => orderCreatedInMonth(o, monthKey));
}

/** Display date without time (for order lists). */
export function orderDisplayDate(createdAt: string | null | undefined): string {
  const raw = createdAt?.trim();
  if (!raw) return "-";
  return raw.slice(0, 10);
}
