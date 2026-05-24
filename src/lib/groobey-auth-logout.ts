import { supabase } from "@/integrations/supabase/client";

/** Sign out and hard-navigate to login so refresh does not restore the session. */
export async function groobeySignOut(): Promise<void> {
  if (typeof window !== "undefined") {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("groobey-workspace-notifications")) {
        sessionStorage.removeItem(key);
      }
    }
  }
  await supabase.auth.signOut({ scope: "local" });
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
