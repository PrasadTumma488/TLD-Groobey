import {
  billIdMetaRowsForKind,
  buildGroobeyBillDocumentHtml,
  groobeyBillColumnsForKind,
  groobeyBillTitleForKind,
  type BillKind,
  type GroobeyBillMetaRow,
  type GroobeyBillTableColumn,
  type GroobeyBillTableRow,
} from "@/lib/groobey-bill-template";
import {
  showGroobeyBillPreview,
  type BillPreviewShowOptions,
} from "@/lib/groobey-bill-preview-bridge";
import {
  parseGroceryOrderItemLine,
  resolveBillQtyAndKgs,
  resolveSaleItemPackUnit,
  stripPackFromItemName,
} from "@/lib/groobey-bill-qty";
import { resolveCustomerStreetAddressForBill } from "@/lib/groobey-delivery-order-fields";
import { EM_DASH, formatInr } from "@/lib/groobey-currency";
import {
  clampMarginPercent,
  tradeAmountFromRetail,
  tradeUnitFromRetail,
} from "@/lib/groobey-trade-margin";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";

export type { BillKind } from "@/lib/groobey-bill-template";

/** Line on a sale bill (snapshot at sale time). */
export type SaleBillLine = {
  productId: string | null;
  name: string;
  quantity: number;
  /** Pack size snapshot (e.g. 1 kg) - shown on bill qty as K / GS. */
  packUnit?: string;
  /** Customer-facing unit price (retail). */
  unitPriceRetail: number;
  /** Shop settlement unit price (trade / cost to Groobey). */
  unitPriceMerchant: number;
};

export function lineRetailTotal(line: SaleBillLine): number {
  return Math.round(line.quantity * line.unitPriceRetail);
}

export function lineMerchantTotal(line: SaleBillLine): number {
  return Math.round(line.quantity * line.unitPriceMerchant);
}

export function sumRetail(lines: SaleBillLine[]): number {
  return lines.reduce((s, l) => s + lineRetailTotal(l), 0);
}

export function sumMerchant(lines: SaleBillLine[]): number {
  return lines.reduce((s, l) => s + lineMerchantTotal(l), 0);
}

export type SaleBillItemRow = {
  product_id: string | null;
  product_name: string;
  product_unit?: string | null;
  quantity: number;
  unit_price: number;
  merchant_unit_price?: number | null;
};

function billLineFromSaleItem(row: SaleBillItemRow, retail: number, trade: number): SaleBillLine {
  return {
    productId: row.product_id,
    name: row.product_name,
    quantity: Number(row.quantity || 0),
    packUnit: resolveSaleItemPackUnit(row) || undefined,
    unitPriceRetail: retail,
    unitPriceMerchant: trade,
  };
}

function saleLineToCustomerRow(line: SaleBillLine): GroobeyBillTableRow {
  const { qty, kgs } = resolveBillQtyAndKgs(line.quantity, line.packUnit);
  return {
    item: stripPackFromItemName(line.name),
    qty,
    kgs,
    rate: formatInr(line.unitPriceRetail),
    amount: formatInr(lineRetailTotal(line)),
  };
}

function saleLineToMerchantRow(line: SaleBillLine): GroobeyBillTableRow {
  const { qty, kgs } = resolveBillQtyAndKgs(line.quantity, line.packUnit);
  return {
    item: stripPackFromItemName(line.name),
    qty,
    kgs,
    retail: formatInr(line.unitPriceRetail),
    tradeRate: formatInr(line.unitPriceMerchant),
    amount: formatInr(lineMerchantTotal(line)),
  };
}

const TRADE_PRICE_EPS = 0.004;

function lineHasStoredTrade(row: SaleBillItemRow): boolean {
  const retail = Number(row.unit_price || 0);
  const trade = Number(row.merchant_unit_price);
  return retail > 0 && Number.isFinite(trade) && trade > 0 && trade < retail - TRADE_PRICE_EPS;
}

/** Infer margin % from saved line trade prices (existing sales with snapshots). */
export function inferMarginPercentFromItems(items: SaleBillItemRow[]): number | null {
  for (const row of items) {
    if (!lineHasStoredTrade(row)) continue;
    const retail = Number(row.unit_price || 0);
    const trade = Number(row.merchant_unit_price);
    return clampMarginPercent(Math.round((1 - trade / retail) * 10000) / 100);
  }
  return null;
}

/**
 * Margin % for trade bills: line snapshots, then sale record, then shop policy
 * (platform admin / shop owner).
 */
export function resolveTradeMarginPercent(params: {
  saleApplied?: number | null;
  shopMargin?: number | null;
  items?: SaleBillItemRow[];
}): number {
  const inferred = params.items?.length ? inferMarginPercentFromItems(params.items) : null;
  if (inferred != null && inferred > 0) return inferred;
  const applied = clampMarginPercent(Number(params.saleApplied ?? 0));
  if (applied > 0) return applied;
  return clampMarginPercent(Number(params.shopMargin ?? 0));
}

/** Customer bill: retail only from sale line snapshots (unit_price). */
export function customerBillLinesFromItems(items: SaleBillItemRow[]): SaleBillLine[] {
  return items.map((row) => {
    const retail = Number(row.unit_price || 0);
    return billLineFromSaleItem(row, retail, retail);
  });
}

/** Trade bill: use saved trade per line when present; else retail minus margin %. */
export function tradeBillLinesFromItems(
  items: SaleBillItemRow[],
  marginPercent: number,
): SaleBillLine[] {
  const pct = clampMarginPercent(marginPercent);
  const legacyLines = items.every((row) => !lineHasStoredTrade(row));

  return items.map((row) => {
    const retail = Number(row.unit_price || 0);
    const trade =
      !legacyLines && lineHasStoredTrade(row) ?
        Number(row.merchant_unit_price)
      : tradeUnitFromRetail(retail, pct);
    return billLineFromSaleItem(row, retail, trade);
  });
}

export function saleBillLinesForKind(
  items: SaleBillItemRow[],
  kind: BillKind,
  marginPercent: number,
): SaleBillLine[] {
  if (kind === "customer") return customerBillLinesFromItems(items);
  return tradeBillLinesFromItems(items, marginPercent);
}

/** @deprecated Prefer saleBillLinesForKind with resolveTradeMarginPercent. */
export function saleBillLinesFromItems(
  items: SaleBillItemRow[],
  marginPercentApplied: number | null | undefined,
): SaleBillLine[] {
  return tradeBillLinesFromItems(items, clampMarginPercent(Number(marginPercentApplied ?? 0)));
}

export function buildVerifiedSaleBillHtml(params: {
  kind: BillKind;
  billNumber: string | null;
  shopName: string;
  ownerOrShopLabel: string;
  dateLabel: string;
  lines: SaleBillLine[];
  appliedGroobeyMarginPercent?: number | null;
  extraHtml?: string;
}): string {
  const {
    kind,
    billNumber,
    shopName,
    ownerOrShopLabel,
    dateLabel,
    lines,
    extraHtml,
    appliedGroobeyMarginPercent,
  } = params;
  const marginPct =
    kind === "merchant" &&
    appliedGroobeyMarginPercent != null &&
    Number.isFinite(appliedGroobeyMarginPercent) ?
      clampMarginPercent(Number(appliedGroobeyMarginPercent))
    : null;
  const retailTotal = sumRetail(lines);
  const tradeTotal = sumMerchant(lines);
  const marginAmt = Math.round(retailTotal - tradeTotal);
  const total = kind === "customer" ? retailTotal : tradeTotal;

  const tableRows: GroobeyBillTableRow[] =
    kind === "customer" ?
      lines.map(saleLineToCustomerRow)
    : lines.map(saleLineToMerchantRow);

  const marginNoteHtml =
    kind === "merchant" && marginPct != null ?
      `<p class="groobey-bill-margin-note"><strong>Shop Groobey margin on this sale:</strong> ${marginPct}% off retail on every line</p>`
    : "";

  const footerTotalsHtml =
    kind === "merchant" ?
      `<div class="groobey-bill-extra">
        <p><strong>Retail total:</strong> ${formatInr(retailTotal)}</p>
        <p><strong>Trade total (after margin):</strong> ${formatInr(tradeTotal)}</p>
        <p><strong>Margin (retail - trade):</strong> ${formatInr(marginAmt)}</p>
      </div>`
    : "";

  const meta =
    kind === "customer" ?
      [
        ...billIdMetaRowsForKind(
          billNumber,
          dateLabel,
          kind,
          "Pending (assigned when sale is verified)",
        ),
        { label: "From", value: GROOBEY_APP_NAME },
      ]
    : [
        ...billIdMetaRowsForKind(
          billNumber,
          dateLabel,
          kind,
          "Pending (assigned when sale is verified)",
        ),
        { label: "Shop", value: shopName },
        { label: "Shop / staff", value: ownerOrShopLabel },
      ];

  return buildGroobeyBillDocumentHtml({
    kind,
    billTitle: groobeyBillTitleForKind(kind, billNumber),
    pageTitle: kind === "customer" ? "Bill" : "Settlement bill",
    meta,
    columns: groobeyBillColumnsForKind(kind),
    rows: tableRows,
    totalInr: total,
    marginNoteHtml,
    footerTotalsHtml,
    notesHtml: extraHtml ?? "",
  });
}

export function fromSaleItemRow(row: SaleBillItemRow): SaleBillLine {
  const retail = Number(row.unit_price || 0);
  const trade = Number(row.merchant_unit_price ?? retail);
  return billLineFromSaleItem(row, retail, trade);
}

export { formatStaffBillLabel } from "@/lib/groobey-identity";

function customerOrderItemsToRows(
  orderItemsText: string,
  kind: BillKind,
  totalRetail: number,
  totalMerchant: number,
  marginPercent: number,
): GroobeyBillTableRow[] {
  const text = orderItemsText.trim() || "(no items)";
  const chunks = text
    .split(/[;\n]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const total = kind === "customer" ? totalRetail : totalMerchant;

  const parsed = chunks
    .map((chunk) => {
      const p = parseGroceryOrderItemLine(chunk);
      if (!p) return null;
      const unitPriceMatch = chunk.match(/@\s*₹\s*([\d,.]+)/u);
      const lineTotalMatch = chunk.match(/=\s*₹\s*([\d,.]+)/u);
      const unitPrice = unitPriceMatch ? Number(unitPriceMatch[1].replace(/,/g, "")) : NaN;
      const lineTotal = lineTotalMatch ? Number(lineTotalMatch[1].replace(/,/g, "")) : NaN;
      const amount =
        Number.isFinite(lineTotal) ? lineTotal
        : Number.isFinite(unitPrice) ? Math.round(unitPrice * p.quantity)
        : EM_DASH;
      const rate =
        Number.isFinite(unitPrice) ? unitPrice
        : typeof amount === "number" && p.quantity > 0 ?
          Math.round(amount / p.quantity)
        : NaN;
      const retailAmt =
        Number.isFinite(rate) ? Math.round(rate * p.quantity)
        : typeof amount === "number" ? amount
        : NaN;
      const tradeRate =
        Number.isFinite(rate) ? tradeUnitFromRetail(rate, marginPercent) : NaN;
      const tradeAmt =
        Number.isFinite(tradeRate) ? Math.round(tradeRate * p.quantity) : NaN;
      const { qty, kgs } = resolveBillQtyAndKgs(p.quantity, p.packUnit);
      const item = stripPackFromItemName(p.name);
      if (kind === "merchant") {
        return {
          item,
          qty,
          kgs,
          retail: Number.isFinite(rate) ? formatInr(rate) : EM_DASH,
          tradeRate: Number.isFinite(tradeRate) ? formatInr(tradeRate) : EM_DASH,
          amount: Number.isFinite(tradeAmt) ? formatInr(tradeAmt) : EM_DASH,
        } satisfies GroobeyBillTableRow;
      }
      return {
        item,
        qty,
        kgs,
        rate: Number.isFinite(rate) ? formatInr(rate) : EM_DASH,
        amount: Number.isFinite(retailAmt) ? formatInr(retailAmt) : EM_DASH,
      } satisfies GroobeyBillTableRow;
    })
    .filter(Boolean) as GroobeyBillTableRow[];

  if (parsed.length) return parsed;

  if (chunks.length <= 1) {
    const tradeTotal = kind === "merchant" ? totalMerchant : total;
    const { qty, kgs } = resolveBillQtyAndKgs(1, null);
    return [
      kind === "merchant" ?
        {
          item: stripPackFromItemName(chunks[0] ?? text),
          qty,
          kgs,
          retail: formatInr(totalRetail),
          tradeRate: formatInr(tradeTotal),
          amount: formatInr(tradeTotal),
        }
      : {
          item: stripPackFromItemName(chunks[0] ?? text),
          qty,
          kgs,
          rate: formatInr(total),
          amount: formatInr(total),
        },
    ];
  }

  return chunks.map((line) =>
    kind === "merchant" ?
      { item: line, qty: EM_DASH, kgs: EM_DASH, retail: EM_DASH, tradeRate: EM_DASH, amount: EM_DASH }
    : { item: line, qty: EM_DASH, kgs: EM_DASH, rate: EM_DASH, amount: EM_DASH },
  );
}

export type CustomerOrderBillSource = {
  bill_number: string | null;
  customer_name: string;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_destination?: string | null;
  order_items: string;
  total_amount: number | null;
  grocery_subtotal?: number | null;
  delivery_charge?: number | null;
  delivery_time_slot?: string | null;
  items_delivered_text?: string | null;
  merchant_settlement_amount?: number | null;
  trade_margin_percent_applied?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

/** Groobey margin % for trade / settlement (shop margin when linked, else value stored on the order). */
export function resolveCustomerOrderTradeMarginPercent(
  order: CustomerOrderBillSource,
  shopMarginPercent?: number | null,
): number {
  const stored = Number(order.trade_margin_percent_applied ?? NaN);
  if (Number.isFinite(stored) && stored > 0) return clampMarginPercent(stored);
  if (shopMarginPercent != null && Number.isFinite(Number(shopMarginPercent))) {
    return clampMarginPercent(Number(shopMarginPercent));
  }
  return clampMarginPercent(Number.isFinite(stored) ? stored : 0);
}

export type CustomerOrderBillTotalsOptions = {
  /** Recompute trade from grocery + margin (settlement / shop owner bills). */
  forMerchant?: boolean;
  shopMarginPercent?: number | null;
};

export function customerOrderBillTotals(
  order: CustomerOrderBillSource,
  options?: CustomerOrderBillTotalsOptions,
) {
  const deliveryCharge = Math.max(0, Math.round(Number(order.delivery_charge ?? 0)));
  const grandRetail = Math.round(Number(order.total_amount || 0));
  const grocerySubtotal = Math.max(
    0,
    Math.round(
      Number(order.grocery_subtotal ?? 0) > 0 ?
        Number(order.grocery_subtotal)
      : grandRetail - deliveryCharge,
    ),
  );
  const marginPct = resolveCustomerOrderTradeMarginPercent(order, options?.shopMarginPercent);
  let grandTrade = Math.round(Number(order.merchant_settlement_amount ?? NaN));
  const storedTradeInvalid = !Number.isFinite(grandTrade) || grandTrade <= 0;
  const tradeMatchesRetail =
    grandTrade >= grandRetail && marginPct > 0 && grocerySubtotal > 0;
  if (
    options?.forMerchant &&
    (storedTradeInvalid || tradeMatchesRetail)
  ) {
    grandTrade = tradeAmountFromRetail(grocerySubtotal, marginPct) + deliveryCharge;
  } else if (storedTradeInvalid) {
    grandTrade = tradeAmountFromRetail(grocerySubtotal, marginPct) + deliveryCharge;
  }
  const groceryTrade =
    deliveryCharge > 0 && grandRetail > deliveryCharge ?
      Math.max(0, grandTrade - deliveryCharge)
    : grandTrade;
  return { grocerySubtotal, deliveryCharge, grandRetail, groceryTrade, grandTrade, marginPct };
}

/** Open customer / settlement bill for a customer_orders row (order taker bills). */
export function printCustomerOrderBill(params: {
  kind: BillKind;
  order: CustomerOrderBillSource;
  shopName?: string | null;
  orderTakerLabel: string;
  /** Shop Groobey margin % - used for settlement (trade) bills when order is shop-linked. */
  shopMarginPercent?: number | null;
  preview?: BillPreviewShowOptions;
}): boolean {
  const forMerchant = params.kind === "merchant";
  const totals = customerOrderBillTotals(params.order, {
    forMerchant,
    shopMarginPercent: params.shopMarginPercent,
  });
  const marginPct = totals.marginPct;
  const html = buildCustomerOrderBillHtml({
    kind: params.kind,
    billNumber: params.order.bill_number,
    shopName: params.shopName ?? null,
    orderTakerLabel: params.orderTakerLabel,
    dateLabel: (params.order.created_at || "").slice(0, 16),
    customerName: params.order.customer_name,
    customerPhone: params.order.customer_phone,
    deliveryAddress: params.order.delivery_address,
    deliveryDestination: params.order.delivery_destination,
    customerStreetAddress: resolveCustomerStreetAddressForBill({
      delivery_address: params.order.delivery_address,
      delivery_destination: params.order.delivery_destination,
      notes: params.order.notes,
    }),
    deliveryTimeSlot: params.order.delivery_time_slot,
    orderItemsText: params.order.order_items,
    grocerySubtotal: totals.grocerySubtotal,
    deliveryCharge: totals.deliveryCharge,
    totalRetail: totals.grandRetail,
    totalMerchant: totals.grandTrade,
    appliedGroobeyMarginPercent: marginPct,
    notes: params.order.notes,
  });
  return openBillPrintGuarded(html, params.kind, params.preview);
}

export type CustomerOrderBillBuildParams = {
  kind: BillKind;
  billNumber: string | null;
  shopName?: string | null;
  orderTakerLabel: string;
  dateLabel: string;
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryDestination?: string | null;
  customerStreetAddress?: string | null;
  deliveryTimeSlot?: string | null;
  orderItemsText: string;
  grocerySubtotal?: number;
  deliveryCharge?: number;
  totalRetail: number;
  totalMerchant: number;
  appliedGroobeyMarginPercent?: number | null;
  notes?: string | null;
};

export type CustomerOrderBillContent = {
  kind: BillKind;
  billTitle: string;
  meta: GroobeyBillMetaRow[];
  columns: GroobeyBillTableColumn[];
  rows: GroobeyBillTableRow[];
  totalInr: number;
  marginNoteHtml: string;
  footerTotalsHtml: string;
  notesHtml: string;
  /** PDF footer note for merchant settlement bills. */
  marginNotePdf?: string;
};

/** Shared bill body for print preview, popup, and emailed PDF (customer orders). */
export function buildCustomerOrderBillContent(
  params: CustomerOrderBillBuildParams,
): CustomerOrderBillContent {
  const {
    kind,
    billNumber,
    shopName,
    orderTakerLabel,
    dateLabel,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryTimeSlot,
    orderItemsText,
    totalRetail,
    totalMerchant,
    appliedGroobeyMarginPercent,
    notes,
  } = params;
  const deliveryCharge = Math.max(0, Math.round(Number(params.deliveryCharge ?? 0)));
  const grocerySubtotal = Math.max(
    0,
    Math.round(
      Number(params.grocerySubtotal ?? 0) > 0 ?
        Number(params.grocerySubtotal)
      : totalRetail - deliveryCharge,
    ),
  );
  const groceryTrade =
    deliveryCharge > 0 && totalRetail > deliveryCharge ?
      Math.max(0, Math.round(totalMerchant - deliveryCharge))
    : totalMerchant;
  const marginPct =
    kind === "merchant" &&
    appliedGroobeyMarginPercent != null &&
    Number.isFinite(appliedGroobeyMarginPercent) ?
      clampMarginPercent(Number(appliedGroobeyMarginPercent))
    : clampMarginPercent(Number(appliedGroobeyMarginPercent ?? 0));
  const total = kind === "customer" ? totalRetail : totalMerchant;
  const margin = Math.round(totalRetail - totalMerchant);
  const billAddress =
    kind === "customer" ?
      resolveCustomerStreetAddressForBill({
        delivery_address: deliveryAddress,
        delivery_destination: params.deliveryDestination,
        notes: params.notes,
        customerStreetAddress: params.customerStreetAddress,
      })
    : deliveryAddress?.trim() ?? "";

  const meta =
    kind === "customer" ?
      [
        ...billIdMetaRowsForKind(billNumber, dateLabel, kind, "Pending"),
        { label: "From", value: GROOBEY_APP_NAME },
        { label: "Customer", value: customerName },
        ...(customerPhone?.trim() ? [{ label: "Phone", value: customerPhone.trim() }] : []),
        ...(billAddress ? [{ label: "Customer address", value: billAddress }] : []),
        ...(deliveryTimeSlot?.trim() ? [{ label: "Delivery time", value: deliveryTimeSlot.trim() }] : []),
        ...(deliveryCharge > 0 ?
          [{ label: "Delivery charge", value: formatInr(deliveryCharge) }]
        : []),
      ]
    : [
        ...billIdMetaRowsForKind(billNumber, dateLabel, kind, "Pending"),
        ...(shopName?.trim() ? [{ label: "Shop", value: shopName.trim() }] : []),
        { label: "Order taker", value: orderTakerLabel },
        { label: "Customer", value: customerName },
        ...(customerPhone?.trim() ? [{ label: "Phone", value: customerPhone.trim() }] : []),
        ...(deliveryAddress?.trim() ? [{ label: "Address", value: deliveryAddress.trim() }] : []),
        ...(deliveryTimeSlot?.trim() ? [{ label: "Delivery time", value: deliveryTimeSlot.trim() }] : []),
      ];

  const tableRows = customerOrderItemsToRows(
    orderItemsText,
    kind,
    grocerySubtotal,
    groceryTrade,
    marginPct,
  );
  if (deliveryCharge > 0) {
    tableRows.push(
      kind === "merchant" ?
        {
          item: "Delivery charge",
          qty: "",
          kgs: "",
          retail: formatInr(deliveryCharge),
          tradeRate: formatInr(deliveryCharge),
          amount: formatInr(deliveryCharge),
        }
      : {
          item: "Delivery charge",
          qty: "",
          kgs: "",
          rate: formatInr(deliveryCharge),
          amount: formatInr(deliveryCharge),
        },
    );
  }
  if (tableRows.length > 1) {
    tableRows.push(
      kind === "merchant" ?
        { item: "Order total", qty: "", kgs: "", retail: "", tradeRate: "", amount: formatInr(total) }
      : { item: "Order total", qty: "", kgs: "", rate: "", amount: formatInr(total) },
    );
  }

  const marginNoteHtml =
    kind === "merchant" && marginPct != null ?
      `<p class="groobey-bill-margin-note"><strong>Groobey margin on this order:</strong> ${marginPct}% off retail</p>`
    : "";

  const footerTotalsHtml =
    kind === "merchant" ?
      `<div class="groobey-bill-extra">
        <p><strong>Retail total:</strong> ${formatInr(totalRetail)}</p>
        <p><strong>Trade total (after margin):</strong> ${formatInr(totalMerchant)}</p>
        <p><strong>Margin (retail - trade):</strong> ${formatInr(margin)}</p>
      </div>`
    : "";

  const notesHtml =
    notes?.trim() ?
      `<p class="groobey-bill-margin-note" style="background:#f8fafc;border-color:#e2e8f0;"><strong>Notes:</strong> ${notes.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`
    : "";

  return {
    kind,
    billTitle: groobeyBillTitleForKind(kind, billNumber),
    meta,
    columns: groobeyBillColumnsForKind(kind),
    rows: tableRows,
    totalInr: total,
    marginNoteHtml,
    footerTotalsHtml,
    notesHtml,
    marginNotePdf:
      kind === "merchant" && margin > 0 ?
        `Groobey margin (retail - trade): ${formatInr(margin)}`
      : undefined,
  };
}

/** Free-text customer order bill - D-Mart style retail receipt. */
export function buildCustomerOrderBillHtml(params: CustomerOrderBillBuildParams): string {
  const content = buildCustomerOrderBillContent(params);
  return buildGroobeyBillDocumentHtml({
    kind: content.kind,
    billTitle: content.billTitle,
    pageTitle: content.kind === "customer" ? "Bill" : "Settlement bill",
    meta: content.meta,
    columns: content.columns,
    rows: content.rows,
    totalInr: content.totalInr,
    marginNoteHtml: content.marginNoteHtml,
    footerTotalsHtml: content.footerTotalsHtml,
    notesHtml: content.notesHtml,
  });
}

/** Server email payload so PDF matches print / preview for a stored customer order. */
export function customerOrderBillEmailOrderBill(
  order: CustomerOrderBillSource,
  shopName?: string | null,
  options?: { forMerchant?: boolean; shopMarginPercent?: number | null },
) {
  const totals = customerOrderBillTotals(order, {
    forMerchant: options?.forMerchant,
    shopMarginPercent: options?.shopMarginPercent,
  });
  return {
    orderItemsText: order.order_items,
    totalAmount: totals.grandRetail,
    grocerySubtotal: totals.grocerySubtotal,
    deliveryCharge: totals.deliveryCharge,
    merchantSettlementAmount: totals.grandTrade,
    tradeMarginPercent: totals.marginPct || undefined,
    customerName: order.customer_name,
    customerPhone: order.customer_phone ?? undefined,
    deliveryAddress: order.delivery_address ?? undefined,
    deliveryDestination: order.delivery_destination ?? undefined,
    customerStreetAddress: resolveCustomerStreetAddressForBill({
      delivery_address: order.delivery_address,
      delivery_destination: order.delivery_destination,
      notes: order.notes,
    }),
    deliveryTimeSlot: order.delivery_time_slot ?? undefined,
    notes: order.notes ?? undefined,
    shopName: shopName?.trim() || undefined,
  };
}

/** Line items for customer-order bill email PDF (parsed pack + qty). */
export function customerOrderItemsForBillEmail(
  orderItemsText: string,
  totalRetail: number,
): Array<{ name: string; quantity: number; packUnit?: string; unitPrice: number }> {
  const chunks = orderItemsText
    .trim()
    .split(/[;\n]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = chunks
    .map((chunk) => {
      const p = parseGroceryOrderItemLine(chunk);
      if (!p) return null;
      const unitPriceMatch = chunk.match(/@\s*₹\s*([\d,.]+)/u);
      const unitPrice = unitPriceMatch ? Number(unitPriceMatch[1].replace(/,/g, "")) : NaN;
      return {
        name: p.name,
        quantity: p.quantity,
        packUnit: p.packUnit,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      };
    })
    .filter(Boolean) as Array<{
    name: string;
    quantity: number;
    packUnit?: string;
    unitPrice: number;
  }>;
  if (lines.length) return lines;
  return [
    {
      name: (chunks[0] ?? orderItemsText).slice(0, 500),
      quantity: 1,
      unitPrice: totalRetail,
    },
  ];
}

/** Open bill preview in the in-app modal (no browser pop-up). */
export function openBillPreview(
  html: string,
  kind: BillKind = "customer",
  options?: BillPreviewShowOptions,
): boolean {
  showGroobeyBillPreview(html, kind, options);
  return true;
}

/** @deprecated use openBillPreview */
export function openBillPrint(html: string): void {
  openBillPreview(html);
}

/** In-app preview; settlement bills show a confirm first. Returns false if user cancels. */
export function openBillPrintGuarded(
  html: string,
  kind: BillKind,
  options?: BillPreviewShowOptions,
): boolean {
  if (kind === "merchant") {
    const ok = window.confirm(
      "TRADE / SETTLEMENT BILL (internal)\n\n" +
        "• For Groobey / shop records only\n" +
        "• Do NOT give this bill to the customer\n\n" +
        "Open settlement bill?",
    );
    if (!ok) return false;
  }
  showGroobeyBillPreview(html, kind, options);
  return true;
}
