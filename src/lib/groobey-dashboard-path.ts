import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isGroobeyPlatformAdminEmail } from "@/lib/groobey-platform-admin";

type AppRole = Database["public"]["Enums"]["app_role"];

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

export type DashboardPath =
  | "/platform-admin"
  | "/shop-owner"
  | "/orders"
  | "/staff"
  | "/shop";

export function pathFromRoleSet(roles: Set<AppRole>): DashboardPath | null {
  if (roles.has("main_admin") || roles.has("admin")) return "/platform-admin";
  if (roles.has("merchant")) return "/shop-owner";
  if (roles.has("order_taker")) return "/orders";
  if (roles.has("employee")) return "/staff";
  if (roles.has("customer")) return "/shop";
  return null;
}

/** All dashboard URLs this user can open (admins also get the customer shop). */
export function dashboardPathsFromRoles(
  roles: Set<AppRole>,
  email?: string | null,
): DashboardPath[] {
  const paths = new Set<DashboardPath>();
  if (roles.has("main_admin") || roles.has("admin")) paths.add("/platform-admin");
  if (roles.has("merchant")) paths.add("/shop-owner");
  if (roles.has("order_taker")) paths.add("/orders");
  if (roles.has("employee")) paths.add("/staff");
  if (roles.has("customer")) paths.add("/shop");
  if (isGroobeyPlatformAdminEmail(email)) {
    paths.add("/shop");
    paths.add("/platform-admin");
  }
  return [...paths];
}

export async function resolveUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
  metadataRole?: unknown,
): Promise<Set<AppRole>> {
  const { data: rows, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = new Set<AppRole>((rows ?? []).map((r) => r.role));
  if (!error && isAppRole(metadataRole)) roles.add(metadataRole);
  return roles;
}

/** Primary dashboard URL for this user (role precedence: owner > merchant > delivery). */
export async function resolvePrimaryDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  metadataRole?: unknown,
): Promise<DashboardPath | null> {
  const roles = await resolveUserRoles(supabase, userId, metadataRole);
  return pathFromRoleSet(roles);
}

export async function userCanOpenDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  path: DashboardPath,
  email?: string | null,
  metadataRole?: unknown,
): Promise<boolean> {
  if (path === "/platform-admin" && isGroobeyPlatformAdminEmail(email)) return true;
  const roles = await resolveUserRoles(supabase, userId, metadataRole);
  return dashboardPathsFromRoles(roles, email).includes(path);
}
