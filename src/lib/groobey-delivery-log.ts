/** Structured delivery log rows stored in attendance.notes */

export type DeliveryLogEntry = {
  billId: string;
  customerName: string;
  /** Grocery / items subtotal only - excludes delivery charge. */
  orderAmount: number;
  deliveryCharge: number;
  deliveredAt: string;
  date: string;
};

const LOG_PREFIX = "GROOBEY_DELIVERY_LOG_v1";

export function splitOrderLineAmounts(order: {
  total_amount: number | null;
  delivery_charge?: number | null;
  grocery_subtotal?: number | null;
}): { itemsAmount: number; deliveryCharge: number; grandTotal: number } {
  const grandTotal = Math.round(Number(order.total_amount || 0));
  const deliveryCharge = Math.round(
    Number(order.delivery_charge ?? 0) > 0 ?
      Number(order.delivery_charge)
    : Math.max(0, grandTotal - Math.round(Number(order.grocery_subtotal ?? 0))),
  );
  const grocery = Math.round(Number(order.grocery_subtotal ?? 0));
  const itemsAmount = grocery > 0 ? grocery : Math.max(0, grandTotal - deliveryCharge);
  return { itemsAmount, deliveryCharge, grandTotal };
}

/** Format HH:mm or HH:mm:ss as 12-hour clock with AM/PM. */
export function formatDeliveryTime12h(raw: string): string {
  const t = raw.trim();
  if (!t || t === "-") return "-";
  const match = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return t;
  let hour = Number(match[1]);
  const minute = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

function timeFromOrderStamp(iso: string | null | undefined): string {
  const slice = (iso || "").slice(11, 16);
  return slice ? formatDeliveryTime12h(slice) : "-";
}

export function buildDeliveryLogNotes(entry: DeliveryLogEntry): string {
  return [
    LOG_PREFIX,
    `bill_id=${entry.billId}`,
    `customer_name=${entry.customerName}`,
    `order_amount=${Math.round(entry.orderAmount)}`,
    `delivery_charge=${Math.round(entry.deliveryCharge)}`,
    `delivered_at=${entry.deliveredAt}`,
    `date=${entry.date}`,
  ].join("\n");
}

export function parseDeliveryLogNotes(notes: string | null | undefined): DeliveryLogEntry | null {
  const text = notes?.trim() ?? "";
  if (!text.includes(LOG_PREFIX)) return parseLegacyDeliveryNotes(text);
  const pick = (key: string) => {
    const m = text.match(new RegExp(`^${key}=(.+)$`, "m"));
    return m?.[1]?.trim() ?? "";
  };
  const billId = pick("bill_id");
  if (!billId) return null;
  const rawTime = pick("delivered_at") || "-";
  return {
    billId,
    customerName: pick("customer_name") || "-",
    orderAmount: Number(pick("order_amount")) || 0,
    deliveryCharge: Number(pick("delivery_charge")) || 0,
    deliveredAt: formatDeliveryTime12h(rawTime),
    date: pick("date") || "",
  };
}

/** Old grocery-line logs - excluded from reports (use delivered orders instead). */
function parseLegacyDeliveryNotes(_text: string): DeliveryLogEntry | null {
  return null;
}

export function isSundayDate(isoDate: string): boolean {
  const day = isoDate?.slice(0, 10);
  if (!day || day.length < 10) return false;
  return new Date(`${day}T12:00:00`).getDay() === 0;
}

/** Rows with a real Bill ID and customer name (not legacy item lists). */
export function isValidDeliveryReportRow(row: DeliveryReportRow): boolean {
  const bill = row.billId?.trim();
  if (!bill || bill === "-") return false;
  const name = row.customerName.trim();
  if (!name || name === "Legacy log" || name === "-") return false;
  if (name.includes("×") && row.orderAmount === 0) return false;
  return true;
}

export function filterDeliveryReportRows(
  rows: DeliveryReportRow[],
  opts?: { excludeSundays?: boolean },
): DeliveryReportRow[] {
  return rows.filter((row) => {
    if (!isValidDeliveryReportRow(row)) return false;
    if (opts?.excludeSundays && row.date && isSundayDate(row.date)) return false;
    return true;
  });
}

export type DeliveryReportRow = DeliveryLogEntry & {
  rowTotal: number;
  source: "log" | "order";
};

export function deliveryReportRowFromOrder(order: {
  bill_number: string | null;
  customer_name: string;
  total_amount: number | null;
  delivery_charge?: number | null;
  grocery_subtotal?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}): DeliveryReportRow {
  const { itemsAmount, deliveryCharge } = splitOrderLineAmounts(order);
  const stamp = (order.updated_at || order.created_at || "").slice(0, 10);
  return {
    billId: order.bill_number?.trim() || "-",
    customerName: order.customer_name,
    orderAmount: itemsAmount,
    deliveryCharge,
    deliveredAt: timeFromOrderStamp(order.updated_at || order.created_at),
    date: stamp,
    rowTotal: itemsAmount + deliveryCharge,
    source: "order",
  };
}

export function mergeMonthDeliveryReport(
  logs: DeliveryLogEntry[],
  deliveredOrders: Parameters<typeof deliveryReportRowFromOrder>[0][],
  monthKey: string,
): DeliveryReportRow[] {
  const byBill = new Map<string, DeliveryReportRow>();

  for (const order of deliveredOrders) {
    const stamp = (order.updated_at || order.created_at || "").slice(0, 7);
    if (stamp !== monthKey) continue;
    const row = deliveryReportRowFromOrder(order);
    if (row.billId !== "-") byBill.set(row.billId, row);
  }

  for (const log of logs) {
    const dateKey = log.date?.slice(0, 7) || monthKey;
    if (dateKey !== monthKey && !log.date) continue;
    if (log.billId === "-") continue;
    if (byBill.has(log.billId)) continue;
    const deliveryCharge = Math.round(log.deliveryCharge);
    let itemsAmount = Math.round(log.orderAmount);
    if (deliveryCharge > 0 && itemsAmount >= deliveryCharge) {
      itemsAmount = itemsAmount - deliveryCharge;
    }
    byBill.set(log.billId, {
      ...log,
      orderAmount: itemsAmount,
      deliveryCharge,
      deliveredAt: formatDeliveryTime12h(log.deliveredAt),
      rowTotal: itemsAmount + deliveryCharge,
      source: "log",
    });
  }

  return filterDeliveryReportRows(
    [...byBill.values()].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.billId.localeCompare(b.billId);
    }),
  );
}

export function groupDeliveryReportByDate(
  rows: DeliveryReportRow[],
): { date: string; rows: DeliveryReportRow[] }[] {
  const map = new Map<string, DeliveryReportRow[]>();
  for (const row of rows) {
    const key = row.date?.slice(0, 10) || "-";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, group]) => ({ date, rows: group }));
}

/** All delivery log blocks stored in one attendance.notes field (multiple per day). */
export function parseAllDeliveryLogNotes(notes: string | null | undefined): DeliveryLogEntry[] {
  const text = notes?.trim() ?? "";
  if (!text.includes(LOG_PREFIX)) return [];
  const entries: DeliveryLogEntry[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const start = text.indexOf(LOG_PREFIX, searchFrom);
    if (start < 0) break;
    const next = text.indexOf(LOG_PREFIX, start + LOG_PREFIX.length);
    const block = next < 0 ? text.slice(start) : text.slice(start, next).replace(/\n---\n\s*$/, "");
    const parsed = parseDeliveryLogNotes(block);
    if (parsed) entries.push(parsed);
    searchFrom = next < 0 ? text.length : next;
  }
  return entries;
}

export function buildDeliveryReportForScope(
  attendanceRows: { notes: string | null }[],
  deliveredOrders: Parameters<typeof deliveryReportRowFromOrder>[0][],
  scope: { monthKey?: string; date?: string },
): DeliveryReportRow[] {
  const logs = attendanceRows
    .flatMap((r) => parseAllDeliveryLogNotes(r.notes))

  if (scope.date) {
    const day = scope.date.slice(0, 10);
    return mergeMonthDeliveryReport(logs, deliveredOrders, day.slice(0, 7)).filter(
      (r) => r.date.slice(0, 10) === day,
    );
  }

  if (scope.monthKey) {
    return mergeMonthDeliveryReport(logs, deliveredOrders, scope.monthKey);
  }

  return [];
}

export function monthReportTotals(rows: DeliveryReportRow[]) {
  const orderAmount = rows.reduce((s, r) => s + r.orderAmount, 0);
  const deliveryCharge = rows.reduce((s, r) => s + r.deliveryCharge, 0);
  return { orderAmount, deliveryCharge, grandTotal: orderAmount + deliveryCharge };
}
