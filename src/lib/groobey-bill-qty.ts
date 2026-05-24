/** Pack-size label on bills (K = kg, GS = grams - grocery trade shorthand). */

export function cleanPackUnitLabel(raw?: string | null): string {
  const unit = (raw ?? "").trim();
  if (!unit) return "";
  return unit.replace(/^\d+(?:\.\d+)?\s*/u, "").trim() || unit;
}

/** Short unit for bill KGS column (e.g. K, GS, L). */
export function abbreviatePackUnitForBill(unit: string): string {
  const u = cleanPackUnitLabel(unit).toLowerCase();
  if (!u) return "";
  if (u === "kg" || u === "kgs" || u === "kilogram" || u === "kilograms" || u === "kilo") return "K";
  if (
    u === "g" ||
    u === "gm" ||
    u === "gms" ||
    u === "gram" ||
    u === "grams" ||
    u.endsWith(" g")
  ) {
    return "GS";
  }
  if (u === "l" || u === "ltr" || u === "litre" || u === "litres" || u === "liter" || u === "liters")
    return "L";
  if (u === "ml" || u === "millilitre" || u === "millilitres") return "ML";
  if (u.length <= 4) return u.toUpperCase();
  return cleanPackUnitLabel(unit);
}

function formatQtyNumber(q: number): string {
  if (!Number.isFinite(q)) return "-";
  if (Number.isInteger(q)) return String(q);
  const rounded = Math.round(q * 1000) / 1000;
  return String(rounded);
}

function isWeightOrVolumeAbbrev(abbrev: string): boolean {
  return abbrev === "K" || abbrev === "GS" || abbrev === "L" || abbrev === "ML";
}

/** Leading amount in pack text: `1 kg` → 1, `500 g` → 500. */
export function parsePackSizeAmount(packUnit: string): number | null {
  const raw = packUnit.trim();
  const m = raw.match(/^([\d.]+)\s*(?:kg|kgs|g|gm|gms|gram|grams|l|ltr|litre|litres|liter|liters|ml)/iu);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^(kg|kgs|kilogram)$/iu.test(raw)) return 1;
  return null;
}

export type BillQtyKgsCells = { qty: string; kgs: string };

/**
 * Qty + KGS columns for bills.
 * - Weight/volume packs (1 kg, 500 g): Qty = units ordered; KGS = total amount (e.g. 2 → `2 K`).
 * - No pack / count-only: Qty and KGS show the same number for clarity.
 */
export function resolveBillQtyAndKgs(
  quantity: number,
  packUnit?: string | null,
): BillQtyKgsCells {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return { qty: "-", kgs: "-" };

  const n = formatQtyNumber(q);
  const raw = (packUnit ?? "").trim();

  if (!raw) {
    return { qty: n, kgs: n };
  }

  const abbrev = abbreviatePackUnitForBill(raw);

  if (isWeightOrVolumeAbbrev(abbrev)) {
    const perPack = parsePackSizeAmount(raw) ?? 1;
    const total = q * perPack;
    const totalStr = formatQtyNumber(total);
    return { qty: n, kgs: `${totalStr} ${abbrev}` };
  }

  const shortPack = abbrev || cleanPackUnitLabel(raw);
  if (!shortPack) {
    return { qty: n, kgs: n };
  }

  return { qty: n, kgs: `${n} ${shortPack}` };
}

/** Bill table Qty cell: count + pack unit (e.g. `2 K`, `1.5 K`). */
export function formatBillQtyCell(quantity: number, packUnit?: string | null): string {
  const { qty, kgs } = resolveBillQtyAndKgs(quantity, packUnit);
  if (qty === kgs) return qty;
  if (kgs === "-") return qty;
  return kgs;
}

/** @deprecated Prefer resolveBillQtyAndKgs */
export function formatBillQtyCount(quantity: number): string {
  return resolveBillQtyAndKgs(quantity, null).qty;
}

/** @deprecated Prefer resolveBillQtyAndKgs */
export function formatBillKgsCell(packUnit?: string | null): string {
  return resolveBillQtyAndKgs(1, packUnit).kgs;
}

/** Item name without trailing `(1 kg)` pack suffix - pack goes in KGS column. */
export function stripPackFromItemName(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(/\s*\([^)]+\)\s*$/u, "").trim();
  return stripped || trimmed;
}

export type SaleItemPackSource = {
  product_id?: string | null;
  product_name?: string;
  product_unit?: string | null;
};

/** Pack size for a sale line: snapshot column, catalog, or `(1 kg)` / inline in name. */
export function resolveSaleItemPackUnit(
  row: SaleItemPackSource,
  productUnitById?: ReadonlyMap<string, string>,
): string {
  const snap = row.product_unit?.trim();
  if (snap) return snap;
  const id = row.product_id?.trim();
  if (id && productUnitById?.get(id)?.trim()) return productUnitById.get(id)!.trim();
  const name = row.product_name ?? "";
  const paren = name.match(/\(([^)]+)\)\s*$/u);
  if (paren?.[1]?.trim()) return paren[1].trim();
  const inline = name.match(/\b(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|gms|grams?|l|ml))\b/iu);
  if (inline?.[1]?.trim()) return inline[1].trim();
  return "";
}

/** Parse `Rice (1 kg) × 2 @ ₹50 = ₹100` style order lines. */
export function parseGroceryOrderItemLine(line: string): {
  name: string;
  packUnit: string;
  quantity: number;
} | null {
  const trimmed = line.trim();
  const m = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*[×x]\s*([\d.]+)/iu);
  if (!m) return null;
  const quantity = Number(m[3]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    name: m[1].trim(),
    packUnit: m[2].trim(),
    quantity,
  };
}
