import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function isAppRole(value: unknown): value is AppRole {
  return (
    value === "main_admin" ||
    value === "admin" ||
    value === "merchant" ||
    value === "employee" ||
    value === "order_taker"
  );
}

function pathFromRoleSet(
  roles: Set<AppRole>,
): "/platform-admin" | "/shop-owner" | "/orders" | "/staff" | null {
  if (roles.has("main_admin") || roles.has("admin")) return "/platform-admin";
  if (roles.has("merchant")) return "/shop-owner";
  if (roles.has("order_taker")) return "/orders";
  if (roles.has("employee")) return "/staff";
  return null;
}

/** Primary dashboard URL for this user (role precedence: owner > merchant > delivery). */
export async function resolvePrimaryDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  metadataRole?: unknown,
): Promise<"/platform-admin" | "/shop-owner" | "/orders" | "/staff" | null> {
  const { data: rows, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = new Set<AppRole>((rows ?? []).map((r) => r.role));
  if (isAppRole(metadataRole)) roles.add(metadataRole);

  if (!error) {
    const path = pathFromRoleSet(roles);
    if (path) return path;
  }

  if (isAppRole(metadataRole)) {
    const metaOnly = new Set<AppRole>([metadataRole]);
    return pathFromRoleSet(metaOnly);
  }

  return null;
}
