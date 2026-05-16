import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const roleSchema = z.enum(["main_admin", "admin", "merchant", "employee", "order_taker"]);

type AppRole = Database["public"]["Enums"]["app_role"];

/** Same rules as server session checks: user_metadata.role, then app_metadata.role. */
export function parseRoleFromAuthClaims(user: User): AppRole | null {
  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  const candidates = [
    meta.role,
    meta.app_role,
    meta.user_role,
    Array.isArray(meta.roles) ? meta.roles[0] : undefined,
    appMeta.role,
    appMeta.app_role,
  ];
  for (const raw of candidates) {
    const direct = roleSchema.safeParse(raw);
    if (direct.success) return direct.data;
    if (typeof raw === "string") {
      const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (normalized === "platform_admin" || normalized === "platformadmin") return "main_admin";
      if (normalized === "administrator") return "admin";
      if (normalized === "super_admin" || normalized === "superadmin") return "main_admin";
      const again = roleSchema.safeParse(normalized);
      if (again.success) return again.data;
    }
  }
  return null;
}
