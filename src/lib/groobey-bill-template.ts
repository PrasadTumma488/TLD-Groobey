export type BillKind = "customer" | "merchant";
import {
  GROOBEY_BRAND,
  GROOBEY_LOGO_DISPLAY,
  groobeyBillThankYouHtml,
  groobeyBillPrintFooterHtml,
  groobeyBillPrintHeaderHtml,
} from "@/lib/groobey-brand";
import { groobeyBillContactHtml } from "@/lib/groobey-bill-contact";
import { formatInrHtml } from "@/lib/groobey-currency";

export type GroobeyBillMetaRow = { label: string; value: string; subValue?: string };

export type GroobeyBillTableColumn = {
  id: string;
  label: string;
  align?: "left" | "right";
};

export type GroobeyBillTableRow = Record<string, string | number>;

/** Max content width for on-screen / print HTML bills (px). */
export const GROOBEY_BILL_SHEET_MAX_WIDTH = {
  customer: 580,
  merchant: 860,
} as const;

export function groobeyBillSheetMaxWidthPx(kind: BillKind): number {
  return kind === "merchant" ? GROOBEY_BILL_SHEET_MAX_WIDTH.merchant : GROOBEY_BILL_SHEET_MAX_WIDTH.customer;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function settlementBannerHtml(): string {
  return `<div role="note" class="groobey-bill-settlement-banner">
    <p class="groobey-bill-settlement-title">INTERNAL SETTLEMENT - DO NOT GIVE TO CUSTOMER</p>
    <p class="groobey-bill-settlement-sub">Trade amounts use the shop Groobey margin on this sale.</p>
  </div>`;
}

export function groobeyBillDocumentStyles(kind: BillKind): string {
  const bodyBg = kind === "customer" ? GROOBEY_BRAND.white : GROOBEY_BRAND.settlementBg;
  const sheetW = groobeyBillSheetMaxWidthPx(kind);
  const isMerchant = kind === "merchant";
  return `<style>
    @page { margin: 12mm; }
    * { box-sizing: border-box; }
    body.groobey-bill {
      margin: 0;
      padding: 20px 16px 28px;
      font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.45;
      color: ${GROOBEY_BRAND.black};
      background: ${bodyBg};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .groobey-bill-sheet {
      width: 100%;
      max-width: ${sheetW}px;
      margin: 0 auto;
    }
    .groobey-bill-header {
      margin: 0 0 16px;
      padding: 8px 0 14px;
      text-align: center;
      border-bottom: 1px solid ${GROOBEY_BRAND.lime};
    }
    .groobey-bill-header--light {
      background: transparent;
    }
    .groobey-bill-logo {
      height: ${GROOBEY_LOGO_DISPLAY.billHeightPx}px;
      width: auto;
      max-width: ${GROOBEY_LOGO_DISPLAY.billMaxWidthPx}px;
      object-fit: contain;
      display: inline-block;
      image-rendering: auto;
    }
    .groobey-bill-header-tagline {
      margin: 6px 0 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: ${GROOBEY_BRAND.silverDark};
    }
    .groobey-bill-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      margin: 0 0 14px;
      padding: 0;
    }
    .groobey-bill-meta-cell--wide {
      grid-column: 1 / -1;
    }
    .groobey-bill-meta-k {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .groobey-bill-meta-v {
      display: block;
      margin-top: 2px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
      color: ${GROOBEY_BRAND.black};
      word-break: break-word;
    }
    .groobey-bill-meta-cell--customer .groobey-bill-meta-v {
      font-size: 15px;
    }
    .groobey-bill-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 2px solid ${GROOBEY_BRAND.lime};
      text-align: center;
    }
    .groobey-bill-footer-brand {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: ${GROOBEY_BRAND.limeDark};
    }
    .groobey-bill-footer-product {
      margin: 4px 0 0;
      font-size: 11px;
      color: ${GROOBEY_BRAND.silverDark};
    }
    .groobey-bill-contact {
      margin: 16px 0 0;
      padding: 12px 0 0;
      border-top: 1px solid #e5e7eb;
      text-align: left;
    }
    .groobey-bill-contact-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
    }
    .groobey-bill-contact-link {
      font-size: 12px;
      font-weight: 700;
      color: #166534;
      text-decoration: none;
    }
    .groobey-bill-meta--customer .groobey-bill-meta-value {
      font-size: 17px;
      font-weight: 800;
      color: ${GROOBEY_BRAND.black};
    }
    .groobey-bill-title {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: ${GROOBEY_BRAND.black};
    }
    body.groobey-bill--customer .groobey-bill-title {
      display: none;
    }
    .groobey-bill-meta {
      margin: 0 0 18px;
      padding: 0;
      list-style: none;
    }
    .groobey-bill-meta li {
      margin: 0 0 8px;
      font-size: 14px;
      line-height: 1.45;
    }
    .groobey-bill-meta strong { font-weight: 700; }
    .groobey-bill-meta-value {
      display: block;
      margin-top: 2px;
      font-weight: 600;
    }
    .groobey-bill-meta-sub {
      margin: 2px 0 0;
      padding-left: 0;
      font-size: 13px;
      font-weight: 500;
      color: #4b5563;
    }
    .groobey-bill-settlement-banner {
      margin: 0 0 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: ${GROOBEY_BRAND.settlementBg};
      border: 3px solid ${GROOBEY_BRAND.settlementBorder};
      color: #7c2d12;
    }
    .groobey-bill-settlement-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
    }
    .groobey-bill-settlement-sub {
      margin: 6px 0 0;
      font-size: 12px;
      font-weight: 600;
    }
    .groobey-bill-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 4px;
      border: 1px solid ${GROOBEY_BRAND.limeDark};
    }
    table.groobey-bill-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      table-layout: fixed;
    }
    table.groobey-bill-table th:first-child,
    table.groobey-bill-table td:first-child {
      word-break: break-word;
    }
    ${
      isMerchant ?
        `body.groobey-bill--merchant table.groobey-bill-table { font-size: 12px; }
    body.groobey-bill--merchant table.groobey-bill-table th,
    body.groobey-bill--merchant table.groobey-bill-table td { padding: 8px 6px; }
    body.groobey-bill--merchant table.groobey-bill-table th:nth-child(1),
    body.groobey-bill--merchant table.groobey-bill-table td:nth-child(1) { width: 26%; }
    body.groobey-bill--merchant table.groobey-bill-table th:nth-child(2),
    body.groobey-bill--merchant table.groobey-bill-table td:nth-child(2) { width: 8%; }
    body.groobey-bill--merchant table.groobey-bill-table th:nth-child(3),
    body.groobey-bill--merchant table.groobey-bill-table td:nth-child(3) { width: 8%; }
    body.groobey-bill--merchant table.groobey-bill-table th:nth-child(n+4),
    body.groobey-bill--merchant table.groobey-bill-table td:nth-child(n+4) { width: 14.5%; }`
      : `body.groobey-bill--customer table.groobey-bill-table th:nth-child(1),
    body.groobey-bill--customer table.groobey-bill-table td:nth-child(1) { width: 34%; }
    body.groobey-bill--customer table.groobey-bill-table th:nth-child(2),
    body.groobey-bill--customer table.groobey-bill-table td:nth-child(2) { width: 10%; }
    body.groobey-bill--customer table.groobey-bill-table th:nth-child(3),
    body.groobey-bill--customer table.groobey-bill-table td:nth-child(3) { width: 10%; }
    body.groobey-bill--customer table.groobey-bill-table th:nth-child(n+4),
    body.groobey-bill--customer table.groobey-bill-table td:nth-child(n+4) { width: 18%; }`
    }
    table.groobey-bill-table thead tr {
      background: ${GROOBEY_BRAND.lime};
      color: ${GROOBEY_BRAND.black};
    }
    table.groobey-bill-table th {
      padding: 10px 8px;
      font-weight: 700;
    }
    table.groobey-bill-table th.text-right,
    table.groobey-bill-table td.text-right { text-align: right; }
    table.groobey-bill-table th.text-left,
    table.groobey-bill-table td.text-left { text-align: left; }
    table.groobey-bill-table tbody td {
      padding: 10px 8px;
      border-top: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .groobey-bill-total {
      margin: 14px 0 0;
      padding-top: 12px;
      border-top: 2px solid ${GROOBEY_BRAND.lime};
      text-align: right;
      font-size: 18px;
      font-weight: 800;
    }
    .groobey-bill-extra { margin-top: 12px; font-size: 13px; color: #333; }
    .groobey-bill-extra p { margin: 4px 0; text-align: right; }
    .groobey-bill-margin-note {
      margin: 12px 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fff7ed;
      border: 1px solid #fdba74;
      font-size: 13px;
    }
    .groobey-bill-thanks {
      margin: 22px 0 0;
      padding: 18px 20px;
      border-radius: 12px;
      text-align: center;
    }
    .groobey-bill-thanks--customer {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfccb 55%, #f7fee7 100%);
      border: 2px solid ${GROOBEY_BRAND.lime};
      box-shadow: 0 4px 14px rgba(154, 205, 50, 0.22);
    }
    .groobey-bill-thanks--merchant {
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 55%, #fffbeb 100%);
      border: 2px solid ${GROOBEY_BRAND.settlementBorder};
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.18);
    }
    .groobey-bill-thanks-title {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: ${GROOBEY_BRAND.black};
    }
    .groobey-bill-thanks-body {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.55;
      color: #374151;
    }
    @media print {
      body.groobey-bill { padding: 0; }
      .groobey-bill-sheet { max-width: 100%; }
    }
  </style>`;
}

export function groobeyBillMetaHtml(rows: GroobeyBillMetaRow[]): string {
  const items = rows
    .filter((r) => r.value.trim())
    .map((r) => {
      const sub =
        r.subValue?.trim() ?
          `<div class="groobey-bill-meta-sub">${esc(r.subValue.trim())}</div>`
        : "";
      const customerRow = r.label === "Customer name" || r.label === "Customer";
      return `<li class="${customerRow ? "groobey-bill-meta--customer" : ""}"><strong>${esc(r.label)}:</strong> <span class="groobey-bill-meta-value">${esc(r.value)}</span>${sub}</li>`;
    })
    .join("");
  return items ? `<ul class="groobey-bill-meta">${items}</ul>` : "";
}

/** Two-column compact meta strip for customer bills. */
export function groobeyBillMetaCompactHtml(rows: GroobeyBillMetaRow[]): string {
  const flat: GroobeyBillMetaRow[] = [];
  for (const row of rows) {
    if (!row.value.trim()) continue;
    flat.push(row);
    if (row.subValue?.trim()) {
      flat.push({ label: "Date", value: row.subValue.trim() });
    }
  }
  if (!flat.length) return "";
  const cells = flat
    .map((r) => {
      const wide = r.label === "Address" || r.label === "Customer address";
      const customer = r.label === "Customer name" || r.label === "Customer";
      return `<div class="groobey-bill-meta-cell${wide ? " groobey-bill-meta-cell--wide" : ""}${customer ? " groobey-bill-meta-cell--customer" : ""}">
        <span class="groobey-bill-meta-k">${esc(r.label)}</span>
        <span class="groobey-bill-meta-v">${esc(r.value)}</span>
      </div>`;
    })
    .join("");
  return `<div class="groobey-bill-meta-grid">${cells}</div>`;
}

export function groobeyBillTableHtml(
  columns: GroobeyBillTableColumn[],
  rows: GroobeyBillTableRow[],
): string {
  const head = columns
    .map((c) => {
      const align = c.align === "right" ? "text-right" : "text-left";
      return `<th class="${align}">${esc(c.label)}</th>`;
    })
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const align = c.align === "right" ? "text-right" : "text-left";
          const raw = row[c.id];
          const val = raw == null ? "" : String(raw);
          return `<td class="${align}">${esc(val)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<div class="groobey-bill-table-wrap">
    <table class="groobey-bill-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

const BILL_TIME_ZONE = "Asia/Kolkata";

export function formatBillDateLabel(isoOrLabel: string): string {
  const raw = isoOrLabel.trim();
  if (!raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Time shown under Bill ID on printed bills (Asia/Kolkata). */
export function formatBillTimeLabel(isoOrLabel: string): string {
  const raw = isoOrLabel.trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BILL_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function billIdMetaValue(
  billNumber: string | null | undefined,
  pendingLabel: string,
): string {
  return billNumber?.trim() || pendingLabel;
}

export function billIdMetaRow(
  billNumber: string | null | undefined,
  dateLabel: string,
  pendingLabel: string,
): GroobeyBillMetaRow {
  return {
    label: "Bill ID",
    value: billIdMetaValue(billNumber, pendingLabel),
    subValue: formatBillTimeLabel(dateLabel),
  };
}

/** Bill ID on customer bills; settlement bills also note the matching customer Bill ID. */
export function billIdMetaRowsForKind(
  billNumber: string | null | undefined,
  dateLabel: string,
  kind: BillKind,
  pendingLabel: string,
): GroobeyBillMetaRow[] {
  const rows: GroobeyBillMetaRow[] = [billIdMetaRow(billNumber, dateLabel, pendingLabel)];
  const id = billNumber?.trim();
  if (id && kind === "merchant") {
    rows.push({
      label: "ID match",
      value: `Same Bill ID as the customer bill (${id})`,
    });
  }
  return rows;
}

export function groobeyBillTitleForKind(
  kind: BillKind,
  billNumber: string | null | undefined,
): string {
  const id = billNumber?.trim();
  if (kind === "merchant") {
    return id ? `Settlement bill · ${id}` : "Settlement bill (trade)";
  }
  return id ? `Bill · ${id}` : "Bill";
}

const CUSTOMER_COLUMNS: GroobeyBillTableColumn[] = [
  { id: "item", label: "Item", align: "left" },
  { id: "qty", label: "Qty", align: "right" },
  { id: "kgs", label: "KGS", align: "right" },
  { id: "rate", label: "Cost", align: "right" },
  { id: "amount", label: "Amount", align: "right" },
];

const TRADE_COLUMNS: GroobeyBillTableColumn[] = [
  { id: "item", label: "Item", align: "left" },
  { id: "qty", label: "Qty", align: "right" },
  { id: "kgs", label: "KGS", align: "right" },
  { id: "retail", label: "Retail", align: "right" },
  { id: "tradeRate", label: "Trade", align: "right" },
  { id: "amount", label: "Amount", align: "right" },
];

export function groobeyBillColumnsForKind(kind: BillKind): GroobeyBillTableColumn[] {
  return kind === "customer" ? CUSTOMER_COLUMNS : TRADE_COLUMNS;
}

function billBodyHtml(params: {
  kind: BillKind;
  billTitle: string;
  meta: GroobeyBillMetaRow[];
  columns: GroobeyBillTableColumn[];
  rows: GroobeyBillTableRow[];
  totalInr: number;
  showSettlement?: boolean;
  marginNoteHtml?: string;
  footerTotalsHtml?: string;
  notesHtml?: string;
  /** Inline `data:` URL or absolute URL so logo loads in email/PDF. */
  logoSrc?: string;
}): string {
  const {
    kind,
    billTitle,
    meta,
    columns,
    rows,
    totalInr,
    showSettlement = kind === "merchant",
    marginNoteHtml = "",
    footerTotalsHtml = "",
    notesHtml = "",
    logoSrc,
  } = params;

  return `
    ${groobeyBillPrintHeaderHtml({ logoSrc, kind })}
    ${showSettlement ? settlementBannerHtml() : ""}
    <h1 class="groobey-bill-title">${esc(billTitle)}</h1>
    ${kind === "customer" ? groobeyBillMetaCompactHtml(meta) : groobeyBillMetaHtml(meta)}
    ${marginNoteHtml}
    ${notesHtml}
    ${groobeyBillTableHtml(columns, rows)}
    ${footerTotalsHtml}
    <p class="groobey-bill-total">Total: ${formatInrHtml(totalInr)}</p>
    ${groobeyBillThankYouHtml(kind)}
    ${kind === "customer" ? groobeyBillContactHtml() : ""}
    ${groobeyBillPrintFooterHtml({ kind })}
  `;
}

/** Full HTML document for print windows. */
export function buildGroobeyBillDocumentHtml(params: {
  kind: BillKind;
  pageTitle: string;
  billTitle?: string;
  meta: GroobeyBillMetaRow[];
  columns: GroobeyBillTableColumn[];
  rows: GroobeyBillTableRow[];
  totalInr: number;
  showSettlement?: boolean;
  marginNoteHtml?: string;
  footerTotalsHtml?: string;
  notesHtml?: string;
  logoSrc?: string;
}): string {
  const billTitle =
    params.billTitle ?? groobeyBillTitleForKind(params.kind, null);
  const body = billBodyHtml({ ...params, billTitle });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(params.pageTitle)}</title>
  ${groobeyBillDocumentStyles(params.kind)}
</head>
<body class="groobey-bill groobey-bill--${params.kind}">
  <div class="groobey-bill-sheet">${body}</div>
</body>
</html>`;
}

/** Inner receipt markup for email (styles inlined on wrapper). */
export function buildGroobeyBillEmailFragment(params: {
  kind: BillKind;
  billTitle?: string;
  meta: GroobeyBillMetaRow[];
  columns: GroobeyBillTableColumn[];
  rows: GroobeyBillTableRow[];
  totalInr: number;
  showSettlement?: boolean;
  marginNoteHtml?: string;
  footerTotalsHtml?: string;
  notesHtml?: string;
  logoSrc?: string;
}): string {
  const billTitle =
    params.billTitle ?? groobeyBillTitleForKind(params.kind, null);
  const body = billBodyHtml({ ...params, billTitle });
  const sheetW = groobeyBillSheetMaxWidthPx(params.kind);
  return `<div style="max-width:${sheetW}px;margin:0 auto;font-family:Segoe UI,system-ui,Arial,sans-serif;color:${GROOBEY_BRAND.black};">
    ${groobeyBillDocumentStyles(params.kind)}
    <div class="groobey-bill-sheet">${body}</div>
  </div>`;
}
