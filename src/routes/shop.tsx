import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CustomerShopDashboard } from "@/components/groobey/customer-shop-dashboard";
import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { ensureMyShopSlug } from "@/lib/groobey-ensure-shop-slug";
import { resolveSessionAccessFromSession } from "@/lib/groobey-public-access";
import { bootstrapAllowlistedRoles } from "@/lib/groobey-session-bootstrap";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";
import { groobeyPageHead } from "@/lib/groobey-seo";

type ShopSearch = {
  category?: string;
  view?: string;
  checkout?: string;
};

export const Route = createFileRoute("/shop")({
  head: () =>
    groobeyPageHead({
      title: "Shop Groceries Online",
      description:
        "Browse groceries, vegetables, fruits, and combo packs. Add to cart and order delivery with TLD Groobey.",
      path: "/shop",
    }),
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
    view: typeof search.view === "string" ? search.view : undefined,
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  component: ShopRoute,
});

function ShopRoute() {
  const { category, view, checkout } = Route.useSearch();
  const [ui, setUi] = useState<"load" | "ok" | "off" | "redirect">("load");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    if (!SHOW_CUSTOMER_PORTAL) {
      setUi("off");
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        setUi("ok");
        return;
      }

      if (session.access_token) {
        try {
          await bootstrapAllowlistedRoles({ data: { requesterToken: session.access_token } });
          await ensureMyShopSlug({ data: { requesterToken: session.access_token } });
        } catch {
          /* best-effort */
        }
      }

      const access = await resolveSessionAccessFromSession(supabase, session);
      if (access.shopPath && access.shopPath !== "/shop") {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (view) params.set("view", view);
        if (checkout === "1") params.set("checkout", "1");
        const suffix = params.toString() ? `?${params}` : "";
        setRedirectTo(`${access.shopPath}${suffix}`);
        setUi("redirect");
        return;
      }

      setUi("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [category, view, checkout]);

  if (ui === "load") return <GroobeyLoadingScreen message="Loading shop…" />;
  if (ui === "off") return <Navigate to="/" replace />;
  if (ui === "redirect" && redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <CustomerShopDashboard
      initialCategoryId={category ?? null}
      initialBrowseView={view ?? null}
      resumeCheckout={checkout === "1"}
    />
  );
}
