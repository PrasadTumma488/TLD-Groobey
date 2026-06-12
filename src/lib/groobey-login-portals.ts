import type { Database } from "@/integrations/supabase/types";
import {
  SHOW_CUSTOMER_PORTAL,
  SHOW_ORDER_TAKER_PORTAL,
  SHOW_SHOP_OWNER_PORTAL,
} from "@/lib/groobey-site-visibility";

export type LoginPortal =
  | "customer"
  | "employee"
  | "merchant"
  | "order_taker"
  | "main_admin";

type AppRole = Database["public"]["Enums"]["app_role"];

export const loginPortalLabels: Record<LoginPortal, string> = {
  customer: "Customer",
  employee: "Delivery staff",
  merchant: "Shop owner",
  order_taker: "Order taker",
  main_admin: "Platform admin",
};

/** Customer storefront sign-in only. */
export function customerLoginPortals(): LoginPortal[] {
  return SHOW_CUSTOMER_PORTAL ? ["customer"] : [];
}

/** Delivery, shop owner, order taker, and platform admin. */
export function staffLoginPortals(): LoginPortal[] {
  const portals: LoginPortal[] = ["employee"];
  if (SHOW_SHOP_OWNER_PORTAL) portals.push("merchant");
  if (SHOW_ORDER_TAKER_PORTAL) portals.push("order_taker");
  portals.push("main_admin");
  return portals;
}

export function defaultCustomerLoginPortal(): LoginPortal {
  return "customer";
}

export function defaultStaffLoginPortal(): LoginPortal {
  return "employee";
}

export function portalFromSearch(raw: string | undefined): LoginPortal | null {
  if (raw === "employee" || raw === "delivery") return "employee";
  if (raw === "customer") return SHOW_CUSTOMER_PORTAL ? "customer" : null;
  if (raw === "merchant") return SHOW_SHOP_OWNER_PORTAL ? "merchant" : null;
  if (raw === "order_taker") return SHOW_ORDER_TAKER_PORTAL ? "order_taker" : null;
  if (raw === "main_admin") return "main_admin";
  return null;
}

export function portalFromStaffSearch(raw: string | undefined): LoginPortal | null {
  const portal = portalFromSearch(raw);
  if (!portal || portal === "customer") return null;
  return staffLoginPortals().includes(portal) ? portal : null;
}

export function portalMatchesRole(portal: LoginPortal, role: AppRole): boolean {
  if (portal === "main_admin") return role === "main_admin" || role === "admin";
  if (portal === "customer") return role === "customer";
  return portal === role;
}

export function isAppRole(value: unknown): value is AppRole {
  return (
    value === "main_admin" ||
    value === "admin" ||
    value === "merchant" ||
    value === "employee" ||
    value === "order_taker" ||
    value === "customer"
  );
}

export function allLoginPortals(): LoginPortal[] {
  const portals: LoginPortal[] = [];
  if (SHOW_CUSTOMER_PORTAL) portals.push("customer");
  portals.push("employee");
  if (SHOW_SHOP_OWNER_PORTAL) portals.push("merchant");
  if (SHOW_ORDER_TAKER_PORTAL) portals.push("order_taker");
  return portals;
}

/** @deprecated Use allLoginPortals */
export function visibleLoginPortals(): LoginPortal[] {
  return allLoginPortals();
}

/** @deprecated Use defaultCustomerLoginPortal or defaultStaffLoginPortal */
export function defaultLoginPortal(): LoginPortal {
  if (SHOW_CUSTOMER_PORTAL) return "customer";
  return "employee";
}
