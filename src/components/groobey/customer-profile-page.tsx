import { Link, useNavigate } from "@tanstack/react-router";
import { Clock3, Loader2, MapPin, Save, UserRound } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { CustomerProfileOrderHistory } from "@/components/groobey/customer-profile-order-history";
import { GroobeyMemberChrome } from "@/components/groobey/groobey-member-chrome";
import { ShopPanel } from "@/components/groobey/groobey-shop-ui";
import { Button } from "@/components/ui/button";
import { Field, InlineFeedback } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isValidCustomerMobile } from "@/lib/groobey-delivery-order-fields";
import { saveCustomerProfile } from "@/lib/groobey-customer-profile";
import { parseInternalPath, safeInternalRedirect } from "@/lib/groobey-guest-shop-cart";
import { memberShopPath } from "@/lib/groobey-member-url";
import { cn } from "@/lib/utils";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileTab = "account" | "history";

export function CustomerProfilePage({
  redirectTo,
  initialTab = "account",
}: {
  redirectTo?: string;
  initialTab?: ProfileTab;
}) {
  const navigate = useNavigate();
  const afterSavePath = safeInternalRedirect(redirectTo);
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ error?: string; notice?: string }>({});

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setEmail(user.email ?? "");
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectTab(next: ProfileTab) {
    setTab(next);
    void navigate({
      to: "/profile",
      search: { redirect: redirectTo, tab: next === "history" ? "history" : undefined },
      replace: true,
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return;

    setSaving(true);
    setAlert({});
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "").trim();
    const profileEmail = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const defaultAddress = String(form.get("defaultAddress") || "").trim();

    if (!displayName) {
      setSaving(false);
      setAlert({ error: "Your name is required." });
      return;
    }
    if (!profileEmail.includes("@")) {
      setSaving(false);
      setAlert({ error: "A valid email is required." });
      return;
    }
    if (!isValidCustomerMobile(phone)) {
      setSaving(false);
      setAlert({ error: "Enter a valid 10-digit mobile number." });
      return;
    }
    if (defaultAddress.length < 5) {
      setSaving(false);
      setAlert({ error: "Delivery address is required." });
      return;
    }

    const { error } = await saveCustomerProfile(supabase, {
      displayName,
      email: profileEmail,
      phone,
      defaultAddress,
    });

    setSaving(false);
    if (error) {
      setAlert({ error: error.message });
      return;
    }

    if (afterSavePath) {
      const { pathname, search } = parseInternalPath(afterSavePath);
      void navigate({ to: pathname, search, replace: true });
      return;
    }

    setAlert({ notice: "Profile saved." });
    void load();
  }

  const shopSlug = profile?.shop_slug?.trim();
  const displayName = profile?.display_name?.trim() || "Account";

  return (
    <GroobeyMemberChrome className="groobey-shop-page pb-10">
      <div className="groobey-shop-wrap groobey-profile-wrap">
        <header className="groobey-shop-topbar">
          <div>
            <h1 className="groobey-shop-topbar-title">{displayName}</h1>
            <p className="groobey-shop-topbar-sub">
              <Link to="/shop" className="font-bold text-primary hover:underline">
                Back to shop
              </Link>
            </p>
          </div>
          {shopSlug ?
            <p className="groobey-shop-hero-link">
              {typeof window !== "undefined" ? window.location.origin : ""}
              {memberShopPath(shopSlug)}
            </p>
          : null}
        </header>

        <nav className="groobey-profile-tabs" aria-label="Profile sections">
          <button
            type="button"
            className={cn("groobey-profile-tab", tab === "account" && "is-active")}
            aria-current={tab === "account" ? "page" : undefined}
            onClick={() => selectTab("account")}
          >
            <UserRound className="size-4" aria-hidden />
            Account
          </button>
          <button
            type="button"
            className={cn("groobey-profile-tab", tab === "history" && "is-active")}
            aria-current={tab === "history" ? "page" : undefined}
            onClick={() => selectTab("history")}
          >
            <Clock3 className="size-4" aria-hidden />
            Order history
          </button>
        </nav>

        <InlineFeedback {...alert} />

        {tab === "history" ?
          <ShopPanel title="Order history">
            <CustomerProfileOrderHistory />
          </ShopPanel>
        : loading ?
          <p className="groobey-shop-profile-loading">Loading…</p>
        : <ShopPanel title="Delivery details">
            <form
              className="groobey-profile-form"
              onSubmit={handleSave}
              key={profile?.user_id ?? "profile-form"}
            >
              <Field
                name="displayName"
                label="Your name"
                icon={UserRound}
                required
                defaultValue={profile?.display_name ?? ""}
              />
              <Field
                name="email"
                label="Email"
                type="email"
                required
                defaultValue={profile?.email?.trim() || email}
              />
              <Field
                name="phone"
                label="Mobile number"
                type="tel"
                required
                defaultValue={profile?.phone ?? ""}
              />
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" /> Delivery address
                </span>
                <textarea
                  name="defaultAddress"
                  required
                  rows={3}
                  defaultValue={profile?.default_address ?? ""}
                  className="rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold outline-none ring-ring focus:ring-2"
                  placeholder="House no., street, area, city"
                />
              </label>
              <Button type="submit" variant="groobey" className="h-11 rounded-xl" disabled={saving}>
                {saving ?
                  <Loader2 className="size-4 animate-spin" />
                : <Save className="size-4" />}
                Save changes
              </Button>
            </form>
          </ShopPanel>
        }
      </div>
    </GroobeyMemberChrome>
  );
}
