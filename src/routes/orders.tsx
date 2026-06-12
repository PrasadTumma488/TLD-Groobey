import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import { OrdersDashboard } from "@/components/groobey/orders-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { parseRoleFromAuthClaims } from "@/lib/groobey-auth-role";
import { resolvePrimaryDashboard } from "@/lib/groobey-dashboard-path";
import { SHOW_ORDER_TAKER_PORTAL } from "@/lib/groobey-site-visibility";

export const Route = createFileRoute("/orders")({
  component: OrdersRoute,
});

function OrdersRoute() {
  const [ui, setUi] = useState<"load" | "ok" | "nav">("load");
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    if (!SHOW_ORDER_TAKER_PORTAL) {
      setTo("/");
      setUi("nav");
      return;
    }
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
        if (!primary) {
          setTo("/");
          setUi("nav");
          return;
        }
        if (primary !== "/orders") {
          setTo(primary);
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

  if (ui === "load") return <GroobeyLoadingScreen message="Loading orders dashboard…" />;
  if (ui === "nav" && to) return <Navigate to={to} />;

  return <OrdersDashboard />;
}
