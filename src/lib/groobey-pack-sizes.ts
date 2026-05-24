/** Standard pack / weight options for grocery items (stored in `products.unit`). */

export type PackSizeOption = { value: string; label: string };

function formatKgLabel(w: number): string {
  const label = Number.isInteger(w) ? `${w} kg` : `${w} kg`;
  return label;
}

function buildGroceryPackSizes(): PackSizeOption[] {
  const grams: PackSizeOption[] = [
    { value: "50 g", label: "50 g" },
    { value: "100 g", label: "100 g" },
    { value: "250 g", label: "250 g" },
    { value: "500 g", label: "500 g" },
  ];
  const kg: PackSizeOption[] = [{ value: "1 kg", label: "1 kg" }];
  for (let i = 3; i <= 20; i++) {
    const w = i / 2;
    const label = formatKgLabel(w);
    kg.push({ value: label, label });
  }
  return [...grams, ...kg];
}

export const GROCERY_PACK_SIZES: readonly PackSizeOption[] = buildGroceryPackSizes();

export const DEFAULT_GROCERY_PACK = "1 kg";

/** Single default for DB / legacy rows; not shown in owner UI. */
export const GROCERY_LIST_CATEGORY = "Grocery";

/** Default pack columns on a blank TLD GROOBY template (you can add more columns anytime). */
export const TLD_TEMPLATE_PACK_HEADERS = [
  "50G",
  "100G",
  "250G",
  "500G",
  "1KG",
  "1.5KG",
  "2KG",
  "2.5KG",
  "3KG",
  "3.5KG",
  "4KG",
  "4.5KG",
  "5KG",
  "5.5KG",
  "6KG",
  "6.5KG",
  "7KG",
  "7.5KG",
  "8KG",
  "8.5KG",
  "9KG",
  "9.5KG",
  "10KG",
] as const;

const knownPackValues = new Set(GROCERY_PACK_SIZES.map((o) => o.value));

export function isKnownPackSize(unit: string): boolean {
  const normalized = normalizePackSizeToken(unit);
  if (!normalized) return false;
  if (knownPackValues.has(normalized)) return true;
  return packUnitSortKey(normalized) < Number.POSITIVE_INFINITY;
}

/** Canonical unit string from Excel column header (50G, 1.5KG, 10 KGS, …) or null if not a pack column. */
export function parsePackSizeFromHeader(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const compact = text.toUpperCase().replace(/\s+/g, "");
  const gram = compact.match(/^(\d+(?:\.\d+)?)(G|GM|GMS|GRAM|GRAMS)?$/);
  if (gram) {
    const n = Number(gram[1]);
    if (Number.isFinite(n) && n > 0 && n < 1000) return `${stripTrailingZero(n)} g`;
  }

  const kg = compact.match(/^(\d+(?:\.\d+)?)(KG|KGS|KILO|KILOS)?$/);
  if (kg) {
    const n = Number(kg[1]);
    if (Number.isFinite(n) && n > 0 && n <= 10) return `${stripTrailingZero(n)} kg`;
  }

  const spaced = text.match(/^(\d+(?:\.\d+)?)\s*(g|kg|kgs)$/i);
  if (spaced) {
    const n = Number(spaced[1]);
    const u = spaced[2].toLowerCase();
    if (!Number.isFinite(n) || n <= 0) return null;
    if (u === "g" && n < 1000) return `${stripTrailingZero(n)} g`;
    if ((u === "kg" || u === "kgs") && n <= 10) return `${stripTrailingZero(n)} kg`;
  }

  return null;
}

function stripTrailingZero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function normalizePackSizeToken(unit: string): string | null {
  const parsed = parsePackSizeFromHeader(unit);
  if (parsed) return parsed;
  const trimmed = unit.trim();
  if (!trimmed) return null;
  const key = packUnitSortKey(trimmed);
  if (!Number.isFinite(key) || key >= 999999) return null;
  return trimmed;
}

/** Sort pack units lightest-first for Excel columns and dropdowns. */
export function packUnitSortKey(unit: string): number {
  const parsed = parsePackSizeFromHeader(unit) ?? unit.trim();
  const m = parsed.match(/^(\d+(?:\.\d+)?)\s*(g|kg)$/i);
  if (!m) return 999999;
  const n = Number(m[1]);
  const isKg = m[2].toLowerCase() === "kg";
  return isKg ? Math.round(n * 1000) : Math.round(n);
}

export function sortPackUnits(units: Iterable<string>): string[] {
  const unique = [...new Set([...units].map((u) => parsePackSizeFromHeader(u) ?? u.trim()).filter(Boolean))];
  return unique.sort((a, b) => packUnitSortKey(a) - packUnitSortKey(b));
}

/** Excel column label for a catalog unit (1.5 kg → 1.5KG). */
export function unitToTldHeader(unit: string): string {
  const canonical = parsePackSizeFromHeader(unit) ?? unit.trim();
  const m = canonical.match(/^(\d+(?:\.\d+)?)\s*(g|kg)$/i);
  if (!m) return canonical.toUpperCase().replace(/\s+/g, "");
  const n = m[1];
  const suffix = m[2].toLowerCase() === "kg" ? "KG" : "G";
  return `${n}${suffix}`;
}

/** Dropdown options: standard sizes plus any units already in your catalog. */
export function mergePackSizeOptions(catalogUnits: Iterable<string>): PackSizeOption[] {
  const map = new Map<string, PackSizeOption>();
  for (const opt of GROCERY_PACK_SIZES) {
    map.set(opt.value, opt);
  }
  for (const raw of catalogUnits) {
    const unit = parsePackSizeFromHeader(raw) ?? raw.trim();
    if (!unit || packUnitSortKey(unit) >= 999999) continue;
    if (!map.has(unit)) map.set(unit, { value: unit, label: unit });
  }
  return sortPackUnits([...map.keys()]).map((value) => map.get(value)!);
}
