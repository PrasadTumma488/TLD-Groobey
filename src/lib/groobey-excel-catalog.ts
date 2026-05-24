import * as XLSX from "xlsx";

import { normalizeCatalogUnit } from "@/lib/groobey-product-catalog";
import {
  parsePackSizeFromHeader,
  sortPackUnits,
  TLD_TEMPLATE_PACK_HEADERS,
  unitToTldHeader,
} from "@/lib/groobey-pack-sizes";

export type ParsedCatalogRow = {
  name: string;
  unit: string;
  price: number;
  defaultQuantity: number;
  category: string;
  /** 1-based spreadsheet row (for error messages). */
  rowNumber: number;
};

export type ParseCatalogExcelResult = {
  rows: ParsedCatalogRow[];
  skipped: number;
  errors: string[];
  format: "tld_groobey" | "legacy";
};

/** TLD GROOBY sheet layout (row 1 title, row 2 headers, data from row 3). */
export const TLD_SHEET_TITLE = "TLD GROOBY";

export const TLD_FIXED_HEADERS = ["S.No", "CATEGORY", "PRODUCT", "MRP"] as const;

export function buildTldSheetHeaders(packUnits: string[]): string[] {
  const packs = packUnits.length ? packUnits.map(unitToTldHeader) : [...TLD_TEMPLATE_PACK_HEADERS];
  return ["S.No", "CATEGORY", "PRODUCT", ...packs, "MRP"];
}

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

const CATEGORY_HEADERS = new Set(["category", "cat", "type", "group"]);

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

const SNO_HEADERS = new Set([
  "s.no",
  "sno",
  "s no",
  "sr",
  "sr no",
  "sr. no",
  "sr.no",
  "serial",
  "serial no",
  "#",
]);

function normHeader(cell: unknown): string {
  return String(cell ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isReservedTldColumn(header: string): boolean {
  const h = normHeader(header);
  if (SNO_HEADERS.has(h) || h === "s.no") return true;
  if (CATEGORY_HEADERS.has(h)) return true;
  if (NAME_HEADERS.has(h) || h === "product") return true;
  if (h === "mrp") return true;
  if (PRICE_HEADERS.has(h) && !parsePackSizeFromHeader(header)) return true;
  return false;
}

function packUnitFromHeader(header: string): string | null {
  if (isReservedTldColumn(header)) return null;
  return parsePackSizeFromHeader(header);
}

function parseNumber(cell: unknown): number | null {
  if (cell == null || cell === "") return null;
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  const s = String(cell).replace(/[,₹\s]/g, "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function rowLooksLikeTldTitle(row: unknown[]): boolean {
  const text = String(row[0] ?? row.join(" ")).toUpperCase();
  return text.includes("TLD") && text.includes("GROOBY");
}

type TldColumnMap = {
  sno: number;
  category: number;
  product: number;
  packCols: { index: number; unit: string }[];
  mrp: number;
};

function detectTldColumns(headerRow: unknown[]): TldColumnMap | null {
  const headers = headerRow.map((c) => String(c ?? "").trim());
  const normalized = headers.map(normHeader);
  let product = -1;
  let category = -1;
  let sno = -1;
  let mrp = -1;
  const packCols: { index: number; unit: string }[] = [];

  normalized.forEach((h, i) => {
    if (SNO_HEADERS.has(h) || h === "s.no") sno = i;
    if (CATEGORY_HEADERS.has(h)) category = i;
    if (NAME_HEADERS.has(h) || h === "product") product = i;
    if (h === "mrp") mrp = i;
    const unit = packUnitFromHeader(headers[i] ?? "");
    if (unit) packCols.push({ index: i, unit });
  });

  if (product < 0) {
    const productIdx = headers.findIndex((h) => normHeader(h) === "product");
    if (productIdx >= 0) product = productIdx;
  }
  if (product < 0) return null;
  if (!packCols.length && mrp < 0) return null;

  if (category < 0 && sno >= 0) {
    const cand = sno + 1;
    if (
      cand < headers.length &&
      cand !== product &&
      cand !== mrp &&
      !packUnitFromHeader(headers[cand] ?? "")
    ) {
      category = cand;
    }
  }

  if (sno < 0) sno = 0;

  return { sno, category, product, packCols, mrp };
}

function findTldHeaderRow(matrix: unknown[][]): { headerRowIndex: number; cols: TldColumnMap } | null {
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const cols = detectTldColumns(matrix[i] ?? []);
    if (cols) return { headerRowIndex: i, cols };
  }
  if (matrix.length >= 2 && rowLooksLikeTldTitle(matrix[0] ?? [])) {
    const cols = detectTldColumns(matrix[1] ?? []);
    if (cols) return { headerRowIndex: 1, cols };
  }
  return null;
}

function isLikelySerialOnlyProductName(name: string): boolean {
  return /^\d+$/.test(name.trim());
}

function parseTldGroobeySheet(matrix: unknown[][]): ParseCatalogExcelResult {
  const errors: string[] = [];
  const tld = findTldHeaderRow(matrix);
  if (!tld) {
    return {
      rows: [],
      skipped: 0,
      errors: ["Could not find TLD GROOBY header row (PRODUCT + pack price columns)."],
      format: "tld_groobey",
    };
  }

  const { headerRowIndex, cols } = tld;
  const rows: ParsedCatalogRow[] = [];
  let skipped = 0;
  const dataStart = headerRowIndex + 1;

  for (let i = dataStart; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    const productName = String(cells[cols.product] ?? "").trim();
    if (!productName) {
      if (cells.some((c) => String(c ?? "").trim())) skipped++;
      continue;
    }

    if (isLikelySerialOnlyProductName(productName)) {
      skipped++;
      continue;
    }

    const category =
      cols.category >= 0 ? String(cells[cols.category] ?? "").trim() || "Grocery" : "Grocery";

    let added = 0;
    for (const pack of cols.packCols) {
      const price = parseNumber(cells[pack.index]);
      if (price == null || price < 0) continue;
      rows.push({
        name: productName,
        unit: pack.unit,
        price: Math.round(price * 100) / 100,
        defaultQuantity: 1,
        category,
        rowNumber: i + 1,
      });
      added++;
    }

    if (cols.mrp >= 0) {
      const mrp = parseNumber(cells[cols.mrp]);
      const oneKgCol = cols.packCols.find((p) => p.unit === "1 kg");
      const has1kg = Boolean(oneKgCol);
      if (mrp != null && mrp >= 0 && !has1kg) {
        rows.push({
          name: productName,
          unit: "1 kg",
          price: Math.round(mrp * 100) / 100,
          defaultQuantity: 1,
          category,
          rowNumber: i + 1,
        });
        added++;
      } else if (mrp != null && mrp >= 0 && oneKgCol) {
        const oneKgPrice = parseNumber(cells[oneKgCol.index]);
        if (oneKgPrice == null || oneKgPrice < 0) {
          rows.push({
            name: productName,
            unit: "1 kg",
            price: Math.round(mrp * 100) / 100,
            defaultQuantity: 1,
            category,
            rowNumber: i + 1,
          });
          added++;
        }
      }
    }

    if (!added) {
      skipped++;
      errors.push(`Row ${i + 1} (“${productName}”): add at least one pack price or MRP.`);
    }
  }

  if (!rows.length && !errors.length) {
    errors.push("No product rows found below the header. Fill CATEGORY, PRODUCT, and pack prices.");
  }

  return { rows, skipped, errors, format: "tld_groobey" };
}

function detectLegacyColumns(headerRow: unknown[]): {
  name: number;
  unit: number;
  price: number;
  qty: number;
  category: number;
} | null {
  const headers = headerRow.map(normHeader);
  let name = -1;
  let unit = -1;
  let price = -1;
  let qty = -1;
  let category = -1;
  headers.forEach((h, i) => {
    if (NAME_HEADERS.has(h)) name = i;
    if (CATEGORY_HEADERS.has(h)) category = i;
    if (UNIT_HEADERS.has(h)) unit = i;
    if (PRICE_HEADERS.has(h)) price = i;
    if (QTY_HEADERS.has(h)) qty = i;
  });
  if (name < 0 && headers.length >= 1) name = 0;
  if (price < 0 && headers.length >= 3) price = 2;
  if (unit < 0 && headers.length >= 2) unit = 1;
  if (name < 0 || price < 0) return null;
  return { name, unit, price, qty, category };
}

function rowToLegacyCatalog(
  cells: unknown[],
  cols: { name: number; unit: number; price: number; qty: number; category: number },
  rowNumber: number,
): ParsedCatalogRow | null {
  const name = String(cells[cols.name] ?? "").trim();
  if (!name || isLikelySerialOnlyProductName(name)) return null;
  const unitRaw = cols.unit >= 0 ? String(cells[cols.unit] ?? "").trim() : "";
  const unit = normalizeCatalogUnit(unitRaw || "1 kg");
  const price = parseNumber(cells[cols.price]);
  if (price == null || price < 0) return null;
  let defaultQuantity = 1;
  if (cols.qty >= 0) {
    const q = parseNumber(cells[cols.qty]);
    if (q != null && q > 0) defaultQuantity = q;
  }
  const category =
    cols.category >= 0 ? String(cells[cols.category] ?? "").trim() || "Grocery" : "Grocery";
  return {
    name,
    unit,
    price: Math.round(price * 100) / 100,
    defaultQuantity,
    category,
    rowNumber,
  };
}

function parseLegacySheet(matrix: unknown[][]): ParseCatalogExcelResult {
  const errors: string[] = [];
  const first = matrix[0] ?? [];
  const colsFromHeader = detectLegacyColumns(first);
  const headerLooksValid =
    colsFromHeader != null &&
    first.some((c) => NAME_HEADERS.has(normHeader(c)) || PRICE_HEADERS.has(normHeader(c)));

  const cols = colsFromHeader ?? { name: 0, unit: 1, price: 2, qty: 3, category: -1 };
  const dataStart = headerLooksValid ? 1 : 0;

  const rows: ParsedCatalogRow[] = [];
  let skipped = 0;

  for (let i = dataStart; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    if (!cells.some((c) => String(c ?? "").trim())) {
      skipped++;
      continue;
    }
    const parsed = rowToLegacyCatalog(cells, cols, i + 1);
    if (!parsed) {
      skipped++;
      const name = String(cells[cols.name] ?? "").trim();
      if (name && !isLikelySerialOnlyProductName(name)) {
        errors.push(`Row ${i + 1} (“${name}”): missing or invalid price.`);
      }
      continue;
    }
    rows.push(parsed);
  }

  if (!rows.length && !errors.length) {
    errors.push("No valid rows found. Use TLD GROOBY format or: item name, pack size, price.");
  }

  return { rows, skipped, errors, format: "legacy" };
}

/** Parse first sheet of .xlsx / .xls or .csv into catalog rows. */
export function parseCatalogExcelBuffer(buffer: ArrayBuffer): ParseCatalogExcelResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", raw: false });
  } catch {
    return {
      rows: [],
      skipped: 0,
      errors: ["Could not read file. Use .xlsx, .xls, or .csv."],
      format: "legacy",
    };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], skipped: 0, errors: ["Workbook has no sheets."], format: "legacy" };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!matrix.length) {
    return { rows: [], skipped: 0, errors: ["Sheet is empty."], format: "legacy" };
  }

  if (rowLooksLikeTldTitle(matrix[0] ?? []) || findTldHeaderRow(matrix)) {
    return parseTldGroobeySheet(matrix);
  }

  const legacyHeaders = matrix[0] ?? [];
  if (detectTldColumns(legacyHeaders)) {
    return parseTldGroobeySheet(matrix);
  }

  return parseLegacySheet(matrix);
}

function createTldGroobeyWorksheet(
  sheetHeaders: string[],
  dataRows: (string | number)[][],
): XLSX.WorkSheet {
  const colCount = sheetHeaders.length;
  const aoa: (string | number)[][] = [[TLD_SHEET_TITLE], sheetHeaders, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
  ws["!cols"] = sheetHeaders.map((h, i) => {
    if (i === 0) return { wch: 6 };
    if (i === 1) return { wch: 14 };
    if (i === 2) return { wch: 28 };
    if (normHeader(h) === "mrp") return { wch: 9 };
    return { wch: 9 };
  });
  return ws;
}

function defaultTemplatePackUnits(): string[] {
  return [...TLD_TEMPLATE_PACK_HEADERS]
    .map((h) => parsePackSizeFromHeader(h))
    .filter((u): u is string => Boolean(u));
}

export function downloadGroceryCatalogTemplate(): void {
  const packUnits = defaultTemplatePackUnits();
  const headers = buildTldSheetHeaders(packUnits);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, createTldGroobeyWorksheet(headers, []), "Grocery list");
  XLSX.writeFile(wb, "TLD-GROOBY-grocery-catalog-template.xlsx");
}

export type CatalogExportRow = {
  name: string;
  unit: string;
  price: number;
  default_quantity?: number | null;
  category?: string | null;
};

type TldProductGroup = {
  category: string;
  name: string;
  prices: Partial<Record<string, number>>;
};

function groupProductsForTldExport(products: CatalogExportRow[]): TldProductGroup[] {
  const map = new Map<string, TldProductGroup>();

  for (const p of products) {
    const name = p.name.trim();
    if (!name) continue;
    const category = (p.category ?? "Grocery").trim() || "Grocery";
    const unit = normalizeCatalogUnit(p.unit);
    const key = `${category.toLowerCase()}|${name.toLowerCase()}`;
    const group = map.get(key) ?? { category, name, prices: {} };
    group.prices[unit] = Math.round(Number(p.price || 0) * 100) / 100;
    map.set(key, group);
  }

  return [...map.values()].sort((a, b) => {
    const byCat = a.category.localeCompare(b.category);
    if (byCat !== 0) return byCat;
    return a.name.localeCompare(b.name);
  });
}

function collectExportPackUnits(groups: TldProductGroup[]): string[] {
  const units = new Set<string>(defaultTemplatePackUnits());
  for (const g of groups) {
    for (const unit of Object.keys(g.prices)) {
      units.add(normalizeCatalogUnit(unit));
    }
  }
  return sortPackUnits(units);
}

function tldGroupToRow(
  serial: number,
  group: TldProductGroup,
  packUnits: string[],
): (string | number)[] {
  const packPrices = packUnits.map((unit) => {
    const v = group.prices[unit];
    return v != null && v > 0 ? v : "";
  });
  const mrp = group.prices["1 kg"] ?? "";
  return [serial, group.category, group.name, ...packPrices, mrp];
}

/** Download the current grocery catalog in TLD GROOBY sheet layout. */
export function downloadGroceryCatalogExport(
  products: CatalogExportRow[],
  fileName = "TLD-GROOBY-grocery-catalog.xlsx",
): void {
  const groups = groupProductsForTldExport(products);
  const packUnits = collectExportPackUnits(groups);
  const headers = buildTldSheetHeaders(packUnits);
  const dataRows = groups.map((g, i) => tldGroupToRow(i + 1, g, packUnits));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, createTldGroobeyWorksheet(headers, dataRows), "Grocery list");
  XLSX.writeFile(wb, fileName);
}
