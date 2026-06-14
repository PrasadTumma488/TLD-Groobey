import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CustomerProfilePage } from "@/components/groobey/customer-profile-page";
import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";
import { groobeyNoIndexHead } from "@/lib/groobey-seo";

export const Route = createFileRoute("/profile")({
  head: () => groobeyNoIndexHead("Your Profile"),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    tab: search.tab === "history" ? ("history" as const) : undefined,
  }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { redirect, tab } = Route.useSearch();
  const [ui, setUi] = useState<"load" | "ok" | "login">("load");

  useEffect(() => {
    if (!SHOW_CUSTOMER_PORTAL) {
      setUi("login");
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setUi("login");
        return;
      }
      setUi("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ui === "load") return <GroobeyLoadingScreen message="Loading profile…" />;
  if (ui === "login") {
    const returnPath = redirect ? `/profile?redirect=${encodeURIComponent(redirect)}` : "/profile";
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnPath)}`} replace />;
  }
  return <CustomerProfilePage redirectTo={redirect} initialTab={tab ?? "account"} />;
}
