import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import { DeliveryDashboard } from "@/components/groobey/delivery-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { verifyDashboardAccess } from "@/lib/groobey-route-guard";
import { groobeyNoIndexHead } from "@/lib/groobey-seo";

export const Route = createFileRoute("/staff")({
  head: () => groobeyNoIndexHead("Staff Dashboard"),
  component: StaffRoute,
});

function StaffRoute() {
  const [ui, setUi] = useState<"load" | "ok" | "nav">("load");
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await verifyDashboardAccess(supabase, "/staff");
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

  if (ui === "load") return <GroobeyLoadingScreen message="Loading delivery dashboard…" />;
  if (ui === "nav" && to) return <Navigate to={to} />;
  return <DeliveryDashboard />;
}
