/** Toggle public website areas without deleting backend routes. Set true to re-enable. */
export const SHOW_SHOP_OWNER_PORTAL = false;
export const SHOW_ORDER_TAKER_PORTAL = false;
export const SHOW_CUSTOMER_PORTAL = true;

/** When false, admin and dashboards show customer bill only (no settlement / merchant copy). */
export const SHOW_SETTLEMENT_BILLS = false;

/** When true, platform admin focuses on online customers and orders (hides shop owner / order taker UI). */
export const ADMIN_CUSTOMER_ORDERS_FOCUS = true;

/** Hide attendance verification UI (admin tab, delivery reports tied to attendance). Re-enable when needed. */
export const SHOW_ATTENDANCE = false;

/** Tabs visible on platform admin when `ADMIN_CUSTOMER_ORDERS_FOCUS` is on. */
export const ADMIN_PLATFORM_TABS = [
  "overview",
  "customers",
  "staff",
  "catalog",
  "sales",
  ...(SHOW_ATTENDANCE ? (["attendance"] as const) : []),
  "profile",
] as const;

const LEGACY_ADMIN_TABS = new Set(["create-logins", "shop-owners", "orders-team"]);

/** Map notification / deep-link tab ids to a tab that exists in the current admin UI. */
export function normalizeAdminPlatformTab(tab: string | undefined): string {
  if (!tab) return "overview";
  if (!ADMIN_CUSTOMER_ORDERS_FOCUS) return tab;
  if (LEGACY_ADMIN_TABS.has(tab)) return "overview";
  if (tab === "bill") return "sales";
  if (!SHOW_ATTENDANCE && tab === "attendance") return "overview";
  return tab;
}

export function isAdminPlatformTab(tab: string): boolean {
  if (!ADMIN_CUSTOMER_ORDERS_FOCUS) return true;
  return (ADMIN_PLATFORM_TABS as readonly string[]).includes(tab);
}

/** Hero slider interval (ms). */
export const HOME_SLIDER_INTERVAL_MS = 3000;
