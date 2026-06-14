import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, MapPin, Phone, UserPlus, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";

import { GroobeyAuthBrand } from "@/components/groobey/groobey-brand-logo";
import { GroobeyPublicLayout } from "@/components/groobey/groobey-public-layout";
import { Button } from "@/components/ui/button";
import { Field, Message, PasswordField } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import { isValidCustomerMobile } from "@/lib/groobey-delivery-order-fields";
import { safeInternalRedirect } from "@/lib/groobey-guest-shop-cart";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";
import { groobeyPageHead } from "@/lib/groobey-seo";
import { registerCustomerAccount } from "@/lib/tldGroobey.functions";

type SignupSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/signup")({
  head: () =>
    groobeyPageHead({
      title: "Create Account",
      description: "Register for TLD Groobey to order fresh groceries online with doorstep delivery.",
      path: "/signup",
    }),
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  const register = useServerFn(registerCustomerAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [doneTo, setDoneTo] = useState<string | null>(null);

  if (!SHOW_CUSTOMER_PORTAL) {
    return <Navigate to="/" replace />;
  }

  const loginHref =
    safeInternalRedirect(redirect) ?
      `/login?redirect=${encodeURIComponent(safeInternalRedirect(redirect)!)}`
    : "/login";

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const defaultAddress = String(form.get("defaultAddress") || "").trim();
    const password = String(form.get("password") || "");

    if (!displayName) {
      setBusy(false);
      setError("Your name is required.");
      return;
    }
    if (!email.includes("@")) {
      setBusy(false);
      setError("A valid email is required.");
      return;
    }
    if (!isValidCustomerMobile(phone)) {
      setBusy(false);
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (defaultAddress.length < 5) {
      setBusy(false);
      setError("Delivery address is required.");
      return;
    }

    try {
      const result = await register({
        data: { displayName, email, phone, defaultAddress, password },
      });
      if (result.needsEmailConfirmation) {
        setNotice(
          "Account created. Check your email to confirm your address, then sign in.",
        );
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setNotice("Account created. Please sign in with your email and password.");
        setDoneTo(loginHref);
        return;
      }
      setDoneTo(safeInternalRedirect(redirect) ?? "/shop");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  if (doneTo) return <Navigate to={doneTo} replace />;

  return (
    <GroobeyPublicLayout showFooter={false}>
      <main className="mx-auto max-w-lg py-8">
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <GroobeyAuthBrand
            title="Create your account"
            subtitle="Customers shop here. Delivery staff: use the email your admin assigned, then sign in."
          />
          <form className="mt-6 space-y-3" onSubmit={handleSignup}>
            <Field name="displayName" label="Your name" icon={UserRound} required />
            <Field name="email" label="Email" type="email" icon={Mail} required />
            <Field name="phone" label="Mobile number" type="tel" icon={Phone} required />
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" /> Delivery address
              </span>
              <textarea
                name="defaultAddress"
                required
                rows={3}
                className="rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold outline-none ring-ring focus:ring-2"
                placeholder="House no., street, area, city"
              />
            </label>
            <PasswordField
              name="password"
              label="Password (min 8 characters)"
              required
              autoComplete="new-password"
            />
            <Button type="submit" variant="groobey" className="h-11 w-full rounded-xl" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
            Already have an account?{" "}
            <Link to={loginHref} className="font-bold text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <div className="mt-4">
            <Message error={error} notice={notice} />
          </div>
        </div>
      </main>
    </GroobeyPublicLayout>
  );
}
