import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import { OwnerDashboard } from "@/components/groobey/owner-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { parseRoleFromAuthClaims } from "@/lib/groobey-auth-role";
import { resolvePrimaryDashboard } from "@/lib/groobey-dashboard-path";

export const Route = createFileRoute("/platform-admin")({
  component: PlatformAdminRoute,
});

function PlatformAdminRoute() {
  const [ui, setUi] = useState<"load" | "ok" | "nav">("load");
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          setTo("/");
          setUi("nav");
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (prof?.is_active === false) {
          await supabase.auth.signOut();
          setTo("/");
          setUi("nav");
          return;
        }
        const primary = await resolvePrimaryDashboard(
          supabase,
          session.user.id,
          parseRoleFromAuthClaims(session.user) ?? session.user.user_metadata?.role,
        );
        if (!primary || primary !== "/platform-admin") {
          setTo(primary ?? "/");
          setUi("nav");
          return;
        }
        setUi("ok");
      } catch {
        if (cancelled) return;
        setTo("/");
        setUi("nav");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ui === "load") return <GroobeyLoadingScreen message="Loading platform admin dashboard…" />;
  if (ui === "nav" && to) return <Navigate to={to} />;

  return (
    <main className="groobey-shell min-h-screen bg-background text-foreground">
      <OwnerDashboard />
    </main>
  );
}
