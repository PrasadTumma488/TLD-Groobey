import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { parseRoleFromAuthClaims } from "@/lib/groobey-auth-role";
import {
  type DashboardPath,
  dashboardPathsFromRoles,
  isAppRole,
  pathFromRoleSet,
  resolveUserRoles,
} from "@/lib/groobey-dashboard-path";
import { resolveMemberShopPath, resolveMemberShopSlug } from "@/lib/groobey-member-url";
import { isGroobeyPlatformAdminEmail } from "@/lib/groobey-platform-admin";
import {
  SHOW_ORDER_TAKER_PORTAL,
  SHOW_SHOP_OWNER_PORTAL,
} from "@/lib/groobey-site-visibility";

type AppRole = Database["public"]["Enums"]["app_role"];

export type SiteAudience = "anonymous" | "member";

export type SessionAccess = {
  audience: SiteAudience;
  email: string | null;
  displayName: string | null;
  shopSlug: string | null;
  shopPath: string | null;
  roles: AppRole[];
  primaryDashboard: DashboardPath | null;
  dashboards: DashboardPath[];
  canAccessShop: boolean;
};

export function filterVisibleDashboards(paths: DashboardPath[]): DashboardPath[] {
  return paths.filter((path) => {
    if (path === "/shop-owner" && !SHOW_SHOP_OWNER_PORTAL) return false;
    if (path === "/orders" && !SHOW_ORDER_TAKER_PORTAL) return false;
    return true;
  });
}

const STAFF_DASHBOARD_PATHS = new Set<DashboardPath>([
  "/platform-admin",
  "/shop-owner",
  "/orders",
  "/staff",
]);

export function isStaffDashboardPath(path: string | null | undefined): path is DashboardPath {
  return Boolean(path && STAFF_DASHBOARD_PATHS.has(path as DashboardPath));
}

export function canAccessCustomerShop(
  roles: Iterable<AppRole>,
  email?: string | null,
): boolean {
  if (isGroobeyPlatformAdminEmail(email)) return true;
  for (const role of roles) {
    if (
      role === "customer" ||
      role === "main_admin" ||
      role === "admin" ||
      role === "employee" ||
      role === "order_taker" ||
      role === "merchant"
    ) {
      return true;
    }
  }
  return false;
}

export function dashboardLabel(path: DashboardPath): string {
  switch (path) {
    case "/platform-admin":
      return "Admin panel";
    case "/shop-owner":
      return "Shop owner";
    case "/orders":
      return "Orders desk";
    case "/staff":
      return "Delivery";
    case "/shop":
      return "Order groceries";
    default:
      return "Dashboard";
  }
}

/** Compact label for the public navbar role chips. */
export function dashboardNavLabel(path: DashboardPath): string {
  switch (path) {
    case "/platform-admin":
      return "Admin";
    case "/shop-owner":
      return "Owner";
    case "/orders":
      return "Orders";
    case "/staff":
      return "Delivery";
    case "/shop":
      return "Shop";
    default:
      return "Panel";
  }
}

export function memberDisplayName(email: string | null | undefined) {
  if (!email) return "Account";

  const local = email.split("@")[0] ?? "Account";
  return local
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function resolveMemberDisplayName(
  email: string | null | undefined,
  profileName?: string | null,
  metadataName?: unknown,
) {
  const fromProfile = profileName?.trim();
  if (fromProfile) return fromProfile;

  const fromMeta = String(metadataName ?? "").trim();
  if (fromMeta) return fromMeta;

  return memberDisplayName(email);
}

/** Navbar username chip opens the member's personal workspace. */
export function memberNavPath(access: SessionAccess): string {
  if (access.shopPath) return access.shopPath;
  if (access.canAccessShop) return "/shop";
  return access.primaryDashboard ?? access.dashboards[0] ?? "/";
}

export function memberNavLabel(access: SessionAccess): string {
  const path = memberNavPath(access);
  if (path === "/shop") return dashboardLabel("/shop");
  if (isStaffDashboardPath(path)) return dashboardLabel(path);
  return "Your account";
}

/** Where to land right after sign-in when the user has multiple panels. */
export function postLoginLandingPath(access: SessionAccess): string {
  const shop = access.shopPath ?? (access.canAccessShop ? "/shop" : null);
  const staffPanels = access.dashboards.filter((p) => p !== "/shop");

  if (staffPanels.length === 0) return shop ?? "/";
  if (staffPanels.length === 1 && !shop) return staffPanels[0]!;
  if (shop && staffPanels.length > 0) return shop;
  return access.primaryDashboard ?? staffPanels[0] ?? shop ?? "/";
}

export async function resolveSessionAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  email?: string | null,
  metadataRole?: unknown,
): Promise<SessionAccess> {
  const roles = await resolveUserRoles(supabase, userId, metadataRole);
  const dashboards = filterVisibleDashboards(dashboardPathsFromRoles(roles, email));
  const visiblePrimary = filterVisibleDashboards(
    pathFromRoleSet(roles) ? [pathFromRoleSet(roles)!] : [],
  )[0];
  const primaryDashboard = visiblePrimary ?? dashboards[0] ?? null;
  const shop = canAccessCustomerShop(roles, email);
  return {
    audience: "member",
    email: email ?? null,
    displayName: memberDisplayName(email),
    shopSlug: null,
    shopPath: null,
    roles: [...roles],
    primaryDashboard,
    dashboards,
    canAccessShop: shop,
  };
}

export async function resolveSessionAccessFromSession(
  supabase: SupabaseClient<Database>,
  session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } } | null,
): Promise<SessionAccess> {
  if (!session?.user) {
    return {
      audience: "anonymous",
      email: null,
      displayName: null,
      shopSlug: null,
      shopPath: null,
      roles: [],
      primaryDashboard: null,
      dashboards: [],
      canAccessShop: false,
    };
  }
  const metaRole =
    parseRoleFromAuthClaims(session.user as never) ?? session.user.user_metadata?.role;
  const access = await resolveSessionAccess(
    supabase,
    session.user.id,
    session.user.email,
    metaRole,
  );
  const profile = await fetchMemberProfile(supabase, session.user.id);
  const displayName = resolveMemberDisplayName(
    session.user.email,
    profile?.display_name,
    session.user.user_metadata?.display_name,
  );
  const shopSlug = resolveMemberShopSlug(
    profile?.shop_slug,
    displayName,
    session.user.email,
  );
  const shopPath = resolveMemberShopPath(
    access.canAccessShop,
    profile?.shop_slug,
    displayName,
    session.user.email,
  );
  return {
    ...access,
    displayName,
    shopSlug,
    shopPath,
  };
}

async function fetchMemberProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ display_name: string | null; shop_slug: string | null } | null> {
  const withSlug = await supabase
    .from("profiles")
    .select("display_name, shop_slug")
    .eq("user_id", userId)
    .maybeSingle();
  if (!withSlug.error) return withSlug.data;

  const fallback = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (fallback.error || !fallback.data) return null;
  return { display_name: fallback.data.display_name, shop_slug: null };
}

export function userHasStaffRole(roles: Iterable<string>): boolean {
  for (const r of roles) {
    if (isAppRole(r) && r !== "customer") return true;
  }
  return false;
}
