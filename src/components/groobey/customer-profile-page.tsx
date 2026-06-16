import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  Clock3,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { CustomerAccountSummary } from "@/components/groobey/customer-account-summary";
import { CustomerProfileOrderHistory } from "@/components/groobey/customer-profile-order-history";
import { GroobeyMemberChrome } from "@/components/groobey/groobey-member-chrome";
import { ShopPanel } from "@/components/groobey/groobey-shop-ui";
import { Button } from "@/components/ui/button";
import { Field, InlineFeedback } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isValidCustomerMobile } from "@/lib/groobey-delivery-order-fields";
import { saveCustomerProfile } from "@/lib/groobey-customer-profile";
import { buildTldUserAccountSummary, isValidTldUserId, type TldUserAccountSummary } from "@/lib/groobey-tld-user-account";
import { parseInternalPath, safeInternalRedirect } from "@/lib/groobey-guest-shop-cart";
import { memberShopPath } from "@/lib/groobey-member-url";
import { cn } from "@/lib/utils";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileTab = "account" | "history";

const PROFILE_SELECT =
  "user_id, display_name, email, phone, default_address, groobey_code, created_at, is_active, shop_slug" as const;

async function assignTldUserIdIfNeeded(userId: string, profileRow: Profile): Promise<Profile> {
  if (isValidTldUserId(profileRow.groobey_code)) return profileRow;
  const { data: code, error } = await supabase.rpc("assign_customer_tld_user_id", {
    p_user_id: userId,
  });
  if (error || typeof code !== "string" || !isValidTldUserId(code)) return profileRow;
  return { ...profileRow, groobey_code: code.trim() };
}

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
  const [accountSummary, setAccountSummary] = useState<TldUserAccountSummary | null>(null);
  const [email, setEmail] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editConfirmed, setEditConfirmed] = useState(false);
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
    setAuthDisplayName(String(user.user_metadata?.display_name ?? "").trim());

    const [profileRes, ordersRes] = await Promise.all([
      supabase.from("profiles").select(PROFILE_SELECT).eq("user_id", user.id).maybeSingle(),
      supabase
        .from("customer_orders")
        .select("created_at, created_by")
        .eq("created_by", user.id)
        .is("deleted_at", null),
    ]);

    const orderRows = ordersRes.data ?? [];
    let profileRow = (profileRes.data as Profile | null) ?? null;

    if (profileRow) {
      setProfile(profileRow);
      setAccountSummary(buildTldUserAccountSummary(profileRow, orderRows));
    } else {
      setProfile(null);
      setAccountSummary(null);
    }
    setLoading(false);

    if (!profileRow || isValidTldUserId(profileRow.groobey_code)) return;

    const updated = await assignTldUserIdIfNeeded(user.id, profileRow);
    if (updated.groobey_code !== profileRow.groobey_code) {
      setProfile(updated);
      setAccountSummary(buildTldUserAccountSummary(updated, orderRows));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectTab(next: ProfileTab) {
    setEditing(false);
    setEditConfirmed(false);
    setTab(next);
    void navigate({
      to: "/profile",
      search: { redirect: redirectTo, tab: next === "history" ? "history" : undefined },
      replace: true,
    });
  }

  function cancelEdit() {
    setEditing(false);
    setEditConfirmed(false);
    setAlert({});
  }

  function startEdit() {
    setAlert({});
    setEditing(true);
    setEditConfirmed(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editConfirmed) {
      setAlert({ error: "Confirm that you want to edit your profile before saving." });
      return;
    }

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

    setEditing(false);
    setEditConfirmed(false);
    setAlert({ notice: "Profile updated." });
    void load();
  }

  const shopSlug = profile?.shop_slug?.trim();
  const displayName = profile?.display_name?.trim() || authDisplayName || "Account";

  return (
    <GroobeyMemberChrome className="groobey-shop-page pb-10">
      <div className="groobey-shop-wrap groobey-profile-wrap">
        <header className="groobey-profile-header">
          <div className="groobey-profile-header-main">
            <h1 className="groobey-shop-topbar-title">{displayName}</h1>
            <p className="groobey-profile-header-label">
              {accountSummary ?
                `${accountSummary.userNumberLabel} · ${accountSummary.tldUserId}`
              : "Your shopper profile"}
            </p>
            <Link to="/shop" className="groobey-profile-back-btn">
              <ChevronLeft className="size-5 shrink-0" aria-hidden />
              <span>Back to shop</span>
            </Link>
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
            My profile
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
          <div className="groobey-customer-profile-card groobey-customer-profile-card--loading">
            <Loader2 className="mx-auto size-6 animate-spin text-primary" aria-hidden />
            <p className="groobey-shop-profile-loading mt-3 text-center">Loading your profile…</p>
          </div>
        : <>
            {accountSummary ?
              <div className="groobey-customer-profile-card">
                <CustomerAccountSummary summary={accountSummary} compact={editing} />

                {!editing ?
                  <div className="groobey-customer-profile-actions">
                    <p className="groobey-customer-profile-view-note">
                      <Lock className="size-3.5 shrink-0" aria-hidden />
                      Your details are locked. Tap below only when you need to change them.
                    </p>
                    <Button
                      type="button"
                      variant="groobey"
                      className="h-11 w-full rounded-xl sm:w-auto"
                      onClick={startEdit}
                    >
                      <Pencil className="size-4" />
                      Edit my details
                    </Button>
                  </div>
                : <div className="groobey-customer-profile-edit">
                    <div className="groobey-customer-profile-edit-guard">
                      <ShieldCheck className="size-5 shrink-0 text-amber-700" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-black text-amber-950">Secure edit mode</p>
                        <p className="mt-0.5 text-xs font-semibold leading-snug text-amber-900/90">
                          Only change name, email, phone, or address if this is your account.
                          Wrong details can delay delivery.
                        </p>
                        <label className="groobey-customer-profile-edit-confirm mt-2.5">
                          <input
                            type="checkbox"
                            checked={editConfirmed}
                            onChange={(e) => setEditConfirmed(e.target.checked)}
                          />
                          <span>I confirm I want to edit my profile</span>
                        </label>
                      </div>
                    </div>

                    <form
                      className="groobey-profile-form"
                      onSubmit={handleSave}
                      key={`${profile?.user_id ?? "profile"}-${editConfirmed}`}
                    >
                      <Field
                        name="displayName"
                        label="Your name"
                        icon={UserRound}
                        required
                        disabled={!editConfirmed}
                        defaultValue={profile?.display_name ?? ""}
                      />
                      <Field
                        name="email"
                        label="Email"
                        type="email"
                        required
                        disabled={!editConfirmed}
                        defaultValue={profile?.email?.trim() || email}
                      />
                      <Field
                        name="phone"
                        label="Mobile number"
                        type="tel"
                        required
                        disabled={!editConfirmed}
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
                          disabled={!editConfirmed}
                          defaultValue={profile?.default_address ?? ""}
                          className="rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold outline-none ring-ring focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55"
                          placeholder="House no., street, area, city"
                        />
                      </label>
                      <div className="groobey-customer-profile-edit-buttons">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 flex-1 rounded-xl"
                          onClick={cancelEdit}
                        >
                          <X className="size-4" />
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="groobey"
                          className="h-11 flex-1 rounded-xl"
                          disabled={saving || !editConfirmed}
                        >
                          {saving ?
                            <Loader2 className="size-4 animate-spin" />
                          : <Save className="size-4" />}
                          Save changes
                        </Button>
                      </div>
                    </form>
                  </div>
                }
              </div>
            : <ShopPanel title="My profile">
                <p className="text-sm font-semibold text-muted-foreground">
                  We could not load your profile. Try signing out and back in.
                </p>
              </ShopPanel>
            }
          </>
        }
      </div>
    </GroobeyMemberChrome>
  );
}
