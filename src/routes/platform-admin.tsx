import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import { GroobeyMemberChrome } from "@/components/groobey/groobey-member-chrome";
import { OwnerDashboard } from "@/components/groobey/owner-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { verifyDashboardAccess } from "@/lib/groobey-route-guard";
import { groobeyNoIndexHead } from "@/lib/groobey-seo";

export const Route = createFileRoute("/platform-admin")({
  head: () => groobeyNoIndexHead("Platform Admin"),
  component: PlatformAdminRoute,
});

function PlatformAdminRoute() {
  const [ui, setUi] = useState<"load" | "ok" | "nav">("load");
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await verifyDashboardAccess(supabase, "/platform-admin");
      if (cancelled) return;
      if (result === "ok") {
        setUi("ok");
        return;
      }
      setTo(result === "login" ? "/login" : "/");
      setUi("nav");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ui === "load") return <GroobeyLoadingScreen message="Loading admin dashboard…" />;
  if (ui === "nav" && to) return <Navigate to={to} />;

  return (
    <GroobeyMemberChrome className="pb-8">
      <OwnerDashboard />
    </GroobeyMemberChrome>
  );
}
