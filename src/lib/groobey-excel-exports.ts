import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatDeliveryTime12h,
  splitOrderLineAmounts,
} from "@/lib/groobey-delivery-log";
import type { DeliveryReportRow } from "@/lib/groobey-delivery-log";
import {
  resolveTradeMarginPercent,
  sumMerchant,
  sumRetail,
  tradeBillLinesFromItems,
} from "@/lib/groobey-dual-bill";

/** ISO timestamp → 12-hour clock with AM/PM (date portion unchanged). */
export function formatIsoDateTime12h(iso: string | null | undefined): string {
  const raw = (iso || "").trim();
  if (!raw) return "-";
  const day = raw.slice(0, 10);
  const timePart = raw.slice(11, 19);
  if (!timePart) return day || "-";
  const time12 = formatDeliveryTime12h(timePart.slice(0, 5));
  return day ? `${day} ${time12}` : time12;
}

export function formatIsoDateOnly(iso: string | null | undefined): string {
  const day = (iso || "").slice(0, 10);
  return day || "-";
}

async function writeXlsx(
  sheetName: string,
  rows: Record<string, string | number>[],
  fileName: string,
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export type OrdersReportRow = {
  date: string;
  billId: string;
  customerName: string;
  customerPhone: string;
  status: string;
  shopName: string;
  orderAmount: number;
  deliveryCharge: number;
  rowTotal: number;
  requiredDate: string;
  createdAt12h: string;
};

export type OrdersReportSource = {
  bill_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  shop_id: string | null;
  total_amount: number | null;
  delivery_charge?: number | null;
  grocery_subtotal?: number | null;
  required_date: string | null;
  created_at: string | null;
};

export function buildOrdersReportRows(
  orders: OrdersReportSource[],
  shopNameById: Map<string, string>,
  statusLabels: Record<string, string>,
): OrdersReportRow[] {
  return orders
    .map((order) => {
      const { itemsAmount, deliveryCharge, grandTotal } = splitOrderLineAmounts(order);
      const stamp = order.created_at || "";
      const timePart = stamp.slice(11, 16);
      return {
        date: formatIsoDateOnly(stamp),
        billId: order.bill_number?.trim() || "-",
        customerName: order.customer_name,
        customerPhone: order.customer_phone?.trim() || "-",
        status: statusLabels[order.status] ?? order.status,
        shopName: order.shop_id ? (shopNameById.get(order.shop_id) ?? order.shop_id) : "-",
        orderAmount: itemsAmount,
        deliveryCharge,
        rowTotal: grandTotal,
        requiredDate: formatIsoDateOnly(order.required_date),
        createdAt12h: timePart ? formatDeliveryTime12h(timePart) : "-",
      };
    })
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return a.billId.localeCompare(b.billId);
    });
}

export function ordersReportTotals(rows: OrdersReportRow[]): {
  orderAmount: number;
  deliveryCharge: number;
  grandTotal: number;
} {
  return rows.reduce(
    (acc, row) => ({
      orderAmount: acc.orderAmount + row.orderAmount,
      deliveryCharge: acc.deliveryCharge + row.deliveryCharge,
      grandTotal: acc.grandTotal + row.rowTotal,
    }),
    { orderAmount: 0, deliveryCharge: 0, grandTotal: 0 },
  );
}

/** Order taker orders list - same column style as Deliveries Excel. */
export async function exportOrdersExcel(
  rows: OrdersReportRow[],
  periodLabel: string,
  workerName: string,
): Promise<void> {
  const sheetRows = rows.map((r) => ({
    Date: r.date,
    "Bill ID": r.billId,
    Customer: r.customerName,
    Mobile: r.customerPhone,
    Status: r.status,
    Shop: r.shopName,
    Time: r.createdAt12h,
    "Order amount": r.orderAmount,
    "Delivery charges": r.deliveryCharge,
    Total: r.rowTotal,
    "Required date": r.requiredDate,
  }));
  const totals = ordersReportTotals(rows);
  sheetRows.push({
    Date: "",
    "Bill ID": "",
    Customer: "PERIOD TOTAL",
    Mobile: "",
    Status: "",
    Shop: "",
    Time: "",
    "Order amount": totals.orderAmount,
    "Delivery charges": totals.deliveryCharge,
    Total: totals.grandTotal,
    "Required date": "",
  });
  const safePeriod = periodLabel.replace(/[^\w\s-]/g, "").trim() || "orders";
  const safeName = workerName.replace(/[^\w\s-]/g, "").trim() || "order-taker";
  await writeXlsx("Orders", sheetRows, `orders-report-${safePeriod}-${safeName}.xlsx`);
}

export async function exportDeliveryMonthExcel(
  rows: DeliveryReportRow[],
  monthLabel: string,
  workerName: string,
): Promise<void> {
  const sheetRows = rows.map((r) => ({
    Date: formatIsoDateOnly(r.date),
    Customer: r.customerName,
    Time: r.deliveredAt,
    "Bill ID": r.billId,
    "Order amount": r.orderAmount,
    "Delivery charges": r.deliveryCharge,
    Total: r.rowTotal,
  }));
  const orderAmount = rows.reduce((s, r) => s + r.orderAmount, 0);
  const deliveryCharge = rows.reduce((s, r) => s + r.deliveryCharge, 0);
  sheetRows.push({
    Date: "",
    Customer: "MONTH TOTAL",
    Time: "",
    "Bill ID": "",
    "Order amount": orderAmount,
    "Delivery charges": deliveryCharge,
    Total: orderAmount + deliveryCharge,
  });
  const safeName = workerName.replace(/[^\w\s-]/g, "").trim() || "delivery";
  await writeXlsx(
    "Deliveries",
    sheetRows,
    `delivery-report-${monthLabel.replace(/\s+/g, "-")}-${safeName}.xlsx`,
  );
}

export type SettlementSaleRow = {
  id: string;
  bill_number: string | null;
  shop_id: string | null;
  status: string;
  sold_at: string | null;
  created_at: string | null;
  deleted_at: string | null;
  trade_margin_percent_applied: number | null;
};

export type SettlementOrderRow = {
  id: string;
  bill_number: string | null;
  shop_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  total_amount: number | null;
  delivery_charge?: number | null;
  grocery_subtotal?: number | null;
  merchant_settlement_amount?: number | null;
  deleted_at: string | null;
};

export type SettlementExportInput = {
  monthKey: string;
  monthLabel: string;
  sales: SettlementSaleRow[];
  saleItems: {
    sale_id: string;
    quantity: number;
    unit_price: number;
    trade_unit_price?: number | null;
    product?: { trade_margin_percent?: number | null } | null;
  }[];
  orders: SettlementOrderRow[];
  shopNameById: Map<string, string>;
  shopMarginById: Map<string, number | null | undefined>;
};

export async function exportSettlementMonthExcel(input: SettlementExportInput): Promise<void> {
  const { monthKey, monthLabel, sales, saleItems, orders, shopNameById, shopMarginById } = input;

  const merchantRows = sales
    .filter(
      (s) =>
        s.status === "verified" && (s.sold_at || s.created_at || "").slice(0, 7) === monthKey,
    )
    .map((sale) => {
      const rows = saleItems.filter((row) => row.sale_id === sale.id);
      const marginPct = resolveTradeMarginPercent({
        saleApplied: sale.trade_margin_percent_applied,
        shopMargin: shopMarginById.get(sale.shop_id ?? "") ?? null,
        items: rows,
      });
      const lines = tradeBillLinesFromItems(rows, marginPct);
      const retailT = sumRetail(lines);
      const tradeT = sumMerchant(lines);
      const stamp = sale.sold_at || sale.created_at;
      return {
        Source: "Merchant sale",
        "Bill ID": sale.bill_number ?? "",
        Shop: shopNameById.get(sale.shop_id ?? "") ?? sale.shop_id ?? "",
        Date: formatIsoDateOnly(stamp),
        Time: formatIsoDateTime12h(stamp).split(" ").slice(1).join(" ") || "-",
        Status: sale.status,
        "Order amount": Math.round(retailT),
        "Delivery fee": 0,
        "Retail total": Math.round(retailT),
        "Trade total": Math.round(tradeT),
        Margin: Math.round(retailT - tradeT),
        "Removed from list": sale.deleted_at ? "Yes" : "No",
      };
    });

  const orderRows = orders
    .filter((o) => (o.created_at || "").slice(0, 7) === monthKey)
    .map((order) => {
      const { itemsAmount, deliveryCharge, grandTotal } = splitOrderLineAmounts(order);
      const trade = Math.round(Number(order.merchant_settlement_amount ?? grandTotal));
      const stamp = order.updated_at || order.created_at;
      return {
        Source: "Order taker",
        "Bill ID": order.bill_number ?? "",
        Shop: shopNameById.get(order.shop_id ?? "") ?? order.shop_id ?? "",
        Date: formatIsoDateOnly(stamp),
        Time: formatIsoDateTime12h(stamp).split(" ").slice(1).join(" ") || "-",
        Status: order.status,
        "Order amount": itemsAmount,
        "Delivery fee": deliveryCharge,
        "Retail total": grandTotal,
        "Trade total": trade,
        Margin: grandTotal - trade,
        "Removed from list": order.deleted_at ? "Yes" : "No",
      };
    });

  const allRows = [...merchantRows, ...orderRows];
  const totals = allRows.reduce(
    (acc, row) => ({
      orderAmount: acc.orderAmount + Number(row["Order amount"] || 0),
      deliveryFee: acc.deliveryFee + Number(row["Delivery fee"] || 0),
      retail: acc.retail + Number(row["Retail total"] || 0),
      trade: acc.trade + Number(row["Trade total"] || 0),
      margin: acc.margin + Number(row.Margin || 0),
    }),
    { orderAmount: 0, deliveryFee: 0, retail: 0, trade: 0, margin: 0 },
  );

  allRows.push({
    Source: "MONTH TOTAL",
    "Bill ID": "",
    Shop: "",
    Date: "",
    Time: "",
    Status: "",
    "Order amount": totals.orderAmount,
    "Delivery fee": totals.deliveryFee,
    "Retail total": totals.retail,
    "Trade total": totals.trade,
    Margin: totals.margin,
    "Removed from list": "",
  });

  await writeXlsx(
    "Settlement",
    allRows,
    `groobey-settlement-${monthKey}.xlsx`,
  );
}

/** Append or create one delivery log row per worker per calendar day (avoids unique constraint). */
export async function upsertDeliveryAttendanceLog(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    workDate: string;
    notes: string;
    billId: string;
  },
): Promise<{ error: string | null }> {
  const { workerId, workDate, notes, billId } = params;
  const billKey = `bill_id=${billId}`;

  const { data: existing, error: fetchError } = await supabase
    .from("attendance")
    .select("id, notes")
    .eq("worker_id", workerId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };

  if (existing?.id) {
    const prior = existing.notes ?? "";
    if (prior.includes(billKey)) return { error: null };
    const merged = prior.trim() ? `${prior.trim()}\n---\n${notes}` : notes;
    const { error } = await supabase
      .from("attendance")
      .update({ notes: merged } as never)
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("attendance").insert({
    worker_id: workerId,
    work_date: workDate,
    status: "present",
    check_in: new Date().toISOString(),
    notes,
  } as never);

  return { error: error?.message ?? null };
}
