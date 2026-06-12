import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { parseRoleFromAuthClaims } from "@/lib/groobey-auth-role";
import { type DashboardPath, userCanOpenDashboard } from "@/lib/groobey-dashboard-path";
import { bootstrapAllowlistedRoles } from "@/lib/groobey-session-bootstrap";

/** Refresh pending staff/admin roles, then verify dashboard access. */
export async function verifyDashboardAccess(
  supabase: SupabaseClient<Database>,
  path: DashboardPath,
): Promise<"ok" | "login" | "home"> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return "login";

  const { data: prof } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (prof?.is_active === false) {
    await supabase.auth.signOut();
    return "home";
  }

  if (session.access_token) {
    try {
      await bootstrapAllowlistedRoles({ data: { requesterToken: session.access_token } });
    } catch {
      /* best-effort */
    }
  }

  const metaRole =
    parseRoleFromAuthClaims(session.user) ?? session.user.user_metadata?.role;
  const allowed = await userCanOpenDashboard(
    supabase,
    session.user.id,
    path,
    session.user.email,
    metaRole,
  );
  return allowed ? "ok" : "login";
}
