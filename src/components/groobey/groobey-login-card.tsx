import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState, type ReactNode } from "react";

import { GroobeyAuthBrand } from "@/components/groobey/groobey-brand-logo";
import { Button } from "@/components/ui/button";
import { Field, Message, PasswordField } from "@/components/groobey/workspace-ui";
import { ensurePublicSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { ensureMyShopSlug } from "@/lib/groobey-ensure-shop-slug";
import {
  postLoginLandingPath,
  resolveSessionAccessFromSession,
} from "@/lib/groobey-public-access";
import { bootstrapAllowlistedRoles } from "@/lib/groobey-session-bootstrap";

function phoneCandidates(identifier: string) {
  const compact = identifier.replace(/[\s()-]/g, "");
  const digits = compact.replace(/\D/g, "");
  const candidates = new Set<string>();
  if (compact.startsWith("+") && digits.length >= 10) candidates.add(`+${digits}`);
  if (digits.length === 10) candidates.add(`+91${digits}`);
  if (digits.length > 10) candidates.add(`+${digits}`);
  candidates.add(identifier);
  return Array.from(candidates).filter(Boolean);
}

async function signInWithPhonePassword(identifier: string, password: string) {
  let lastError: { message: string } | null = null;
  for (const phone of phoneCandidates(identifier)) {
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ phone, password });
    if (!loginError) return { data, error: null };
    lastError = loginError;
  }
  return { data: null, error: lastError };
}

function safeInternalRedirect(path?: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

function resolvePostAuthPath(
  access: Awaited<ReturnType<typeof resolveSessionAccessFromSession>>,
  redirectTo?: string | null,
) {
  return safeInternalRedirect(redirectTo) ?? postLoginLandingPath(access);
}

async function finalizeSession(session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) {
  const token = session.access_token;
  if (token) {
    try {
      await bootstrapAllowlistedRoles({ data: { requesterToken: token } });
    } catch {
      /* best-effort */
    }
    try {
      await ensureMyShopSlug({ data: { requesterToken: token } });
    } catch {
      /* slug is optional until migration runs */
    }
  }
  return resolveSessionAccessFromSession(supabase, session);
}

/** One sign-in for customers, delivery staff, and platform admins. */
export function GroobeyLoginCard({
  title,
  subtitle,
  footer,
  redirectTo,
}: {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  /** After sign-in, return here when it is a safe in-app path (e.g. /shop?checkout=1). */
  redirectTo?: string | null;
}) {
  const navigate = useNavigate();
  const redirectedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void ensurePublicSupabaseEnv().then(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session?.user || redirectedRef.current) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const access = await finalizeSession(data.session);
        if (cancelled || redirectedRef.current) return;
        redirectedRef.current = true;
        void navigate({ to: resolvePostAuthPath(access, redirectTo), replace: true });
      } catch {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTo]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const isEmail = identifier.includes("@");
    const { data: loginData, error: loginError } = isEmail
      ? await supabase.auth.signInWithPassword({ email: identifier, password })
      : await signInWithPhonePassword(identifier, password);
    if (loginError) {
      setBusy(false);
      setError(loginError.message);
      return;
    }
    if (!loginData.session?.user) {
      setBusy(false);
      setError("Sign-in succeeded but no session was returned. Please try again.");
      return;
    }

    try {
      const access = await finalizeSession(loginData.session);
      const hasWorkspace =
        access.canAccessShop || access.dashboards.length > 0 || access.roles.length > 0;
      if (!hasWorkspace) {
        await supabase.auth.signOut();
        setBusy(false);
        setError("No account found. Create a free customer account first, then sign in.");
        return;
      }
      redirectedRef.current = true;
      setBusy(false);
      void navigate({ to: resolvePostAuthPath(access, redirectTo), replace: true });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not complete sign-in. Please try again.");
    }
  }

  return (
    <div className="groobey-auth-card rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <GroobeyAuthBrand title={title} subtitle={subtitle} />
      <form className="mt-6 space-y-3" onSubmit={handleLogin}>
        <Field
          name="email"
          label="Email or mobile number"
          icon={Mail}
          required
          disabled={busy || loading}
        />
        <PasswordField
          name="password"
          label="Password"
          icon={LockKeyhole}
          required
          autoComplete="current-password"
          disabled={busy || loading}
        />
        <Button
          type="submit"
          variant="groobey"
          className="h-11 w-full rounded-xl"
          disabled={busy || loading}
        >
          {busy || loading ?
            <Loader2 className="size-4 animate-spin" />
          : <ShieldCheck className="size-4" />}
          Sign in
        </Button>
      </form>
      {footer}
      <div className="mt-4">
        <Message error={error} notice={notice} loading={loading && !busy} />
      </div>
    </div>
  );
}

export function CustomerLoginFooter({ redirectTo }: { redirectTo?: string | null }) {
  const signupTo =
    safeInternalRedirect(redirectTo) ?
      `/signup?redirect=${encodeURIComponent(safeInternalRedirect(redirectTo)!)}`
    : "/signup";

  return (
    <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
      New here?{" "}
      <Link to={signupTo} className="font-bold text-primary hover:underline">
        Create your customer account
      </Link>
    </p>
  );
}
