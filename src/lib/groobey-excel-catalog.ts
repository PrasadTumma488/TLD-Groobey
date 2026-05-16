import * as XLSX from "xlsx";

import { normalizeCatalogUnit } from "@/lib/groobey-product-catalog";
import { DEFAULT_GROCERY_PACK } from "@/lib/groobey-pack-sizes";

export type ParsedCatalogRow = {
  name: string;
  unit: string;
  price: number;
  defaultQuantity: number;
  /** 1-based spreadsheet row (for error messages). */
  rowNumber: number;
};

export type ParseCatalogExcelResult = {
  rows: ParsedCatalogRow[];
  skipped: number;
  errors: string[];
};

const NAME_HEADERS = new Set([
  "name",
  "item",
  "item name",
  "product",
  "product name",
  "grocery",
  "grocery item",
  "description",
]);

const UNIT_HEADERS = new Set([
  "unit",
  "pack",
  "pack size",
  "size",
  "uom",
  "weight",
  "measure",
]);

const PRICE_HEADERS = new Set([
  "price",
  "rate",
  "mrp",
  "retail",
  "retail price",
  "retail rate",
  "amount",
  "selling price",
  "unit price",
]);

const QTY_HEADERS = new Set([
  "qty",
  "quantity",
  "qnt",
  "default qty",
  "default quantity",
  "order qty",
]);

function normHeader(cell: unknown): string {
  return String(cell ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseNumber(cell: unknown): number | null {
  if (cell == null || cell === "") return null;
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  const s = String(cell).replace(/[,₹\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function detectColumns(headerRow: unknown[]): {
  name: number;
  unit: number;
  price: number;
  qty: number;
} | null {
  const headers = headerRow.map(normHeader);
  let name = -1;
  let unit = -1;
  let price = -1;
  let qty = -1;
  headers.forEach((h, i) => {
    if (NAME_HEADERS.has(h)) name = i;
    if (UNIT_HEADERS.has(h)) unit = i;
    if (PRICE_HEADERS.has(h)) price = i;
    if (QTY_HEADERS.has(h)) qty = i;
  });
  if (name < 0 && headers.length >= 1) name = 0;
  if (price < 0 && headers.length >= 3) price = 2;
  if (unit < 0 && headers.length >= 2) unit = 1;
  if (name < 0 || price < 0) return null;
  return { name, unit, price, qty };
}

function rowToCatalog(
  cells: unknown[],
  cols: { name: number; unit: number; price: number; qty: number },
  rowNumber: number,
): ParsedCatalogRow | null {
  const name = String(cells[cols.name] ?? "").trim();
  if (!name) return null;
  const unitRaw = cols.unit >= 0 ? String(cells[cols.unit] ?? "").trim() : "";
  const unit = normalizeCatalogUnit(unitRaw || DEFAULT_GROCERY_PACK);
  const price = parseNumber(cells[cols.price]);
  if (price == null || price < 0) return null;
  let defaultQuantity = 1;
  if (cols.qty >= 0) {
    const q = parseNumber(cells[cols.qty]);
    if (q != null && q > 0) defaultQuantity = q;
  }
  return {
    name,
    unit,
    price: Math.round(price * 100) / 100,
    defaultQuantity,
    rowNumber,
  };
}

/** Parse first sheet of .xlsx / .xls or .csv into catalog rows. */
export function parseCatalogExcelBuffer(buffer: ArrayBuffer): ParseCatalogExcelResult {
  const errors: string[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", raw: false });
  } catch {
    return { rows: [], skipped: 0, errors: ["Could not read file. Use .xlsx, .xls, or .csv."] };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], skipped: 0, errors: ["Workbook has no sheets."] };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!matrix.length) {
    return { rows: [], skipped: 0, errors: ["Sheet is empty."] };
  }

  const first = matrix[0] ?? [];
  const colsFromHeader = detectColumns(first);
  const headerLooksValid =
    colsFromHeader != null &&
    first.some((c) => NAME_HEADERS.has(normHeader(c)) || PRICE_HEADERS.has(normHeader(c)));

  const cols = colsFromHeader ?? { name: 0, unit: 1, price: 2, qty: 3 };
  const dataStart = headerLooksValid ? 1 : 0;

  const rows: ParsedCatalogRow[] = [];
  let skipped = 0;

  for (let i = dataStart; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    if (!cells.some((c) => String(c ?? "").trim())) {
      skipped++;
      continue;
    }
    const parsed = rowToCatalog(cells, cols, i + 1);
    if (!parsed) {
      skipped++;
      const name = String(cells[cols.name] ?? "").trim();
      if (name) errors.push(`Row ${i + 1} (“${name}”): missing or invalid price.`);
      continue;
    }
    rows.push(parsed);
  }

  if (!rows.length && !errors.length) {
    errors.push("No valid rows found. Need columns: item name, pack size, price (qty optional).");
  }

  return { rows, skipped, errors };
}

export function downloadGroceryCatalogTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Item name", "Pack size", "Retail price", "Default qty"],
    ["Rice", "1 kg", 52, 1],
    ["Toor dal", "1 kg", 140, 2],
    ["Sugar", "1 kg", 48, 1],
  ]);
  ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grocery list");
  XLSX.writeFile(wb, "groobey-grocery-list-template.xlsx");
}
