import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LockKeyhole, Mail, ShieldCheck, ShoppingBasket } from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useState } from "react";

import {
  GroobeyAuthBrand,
  GroobeyBrandLogo,
  GroobeyLoadingScreen,
} from "@/components/groobey/groobey-brand-logo";
import { Button } from "@/components/ui/button";
import { GroobeySelect } from "@/components/groobey/groobey-select-field";
import { Field, Message, PasswordField } from "@/components/groobey/workspace-ui";
import { hydratePublicSupabaseEnvFromApi, supabase } from "@/integrations/supabase/client";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import type { Database } from "@/integrations/supabase/types";
import { parseRoleFromAuthClaims } from "@/lib/groobey-auth-role";
import { resolvePrimaryDashboard } from "@/lib/groobey-dashboard-path";
import { isGroobeyPlatformAdminEmail } from "@/lib/groobey-platform-admin";
import { sendPasswordResetEmail } from "@/lib/tldGroobey.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Groobey Merchant Hub" },
      {
        name: "description",
        content:
          "Secure platform admin, shop owner, and staff operations for general grocery retail - rates, shops, sales, and attendance.",
      },
      { property: "og:title", content: "TLD Groobey Grocery Operations" },
      {
        property: "og:description",
        content:
          "Manage grocery store pricing, wholesale sales, shops, and staff attendance from one dashboard.",
      },
    ],
  }),
  component: Index,
});

type AppRole = Database["public"]["Enums"]["app_role"];
type AuthAction = "" | "password";
type LoginPortal = "main_admin" | "merchant" | "order_taker" | "employee";
type DashboardPath = "/platform-admin" | "/shop-owner" | "/orders" | "/staff";

const loginPortalLabels: Record<LoginPortal, string> = {
  main_admin: "Platform Admin",
  merchant: "Shop Owner",
  order_taker: "Order Taker",
  employee: "Delivery boy",
};

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

function friendlyAuthError(message: string, platformAdminSignIn: boolean) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed")) {
    return "Email is not confirmed yet. Ask platform admin to recreate this login or use the confirmed account.";
  }
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return platformAdminSignIn ?
        "Login details are not matching. Check email and password, or use forgot password below."
      : "Login details are not matching. Check your email/mobile and password, or contact platform admin for help.";
  }
  return message;
}

function isAppRole(value: unknown): value is AppRole {
  return (
    value === "main_admin" ||
    value === "admin" ||
    value === "merchant" ||
    value === "order_taker" ||
    value === "employee"
  );
}

function Index() {
  const sendResetEmail = useServerFn(sendPasswordResetEmail);
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [loading, setLoading] = useState(true);
  const [authAction, setAuthAction] = useState<AuthAction>("");
  const [loginPortal, setLoginPortal] = useState<LoginPortal>("merchant");
  const [platformAdminSignIn, setPlatformAdminSignIn] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [pointer, setPointer] = useState({ x: "72%", y: "18%" });
  const [nextDashboard, setNextDashboard] = useState<DashboardPath | null | "resolving">(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await hydratePublicSupabaseEnvFromApi();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (typeof window !== "undefined") {
        const hash = window.location.hash.toLowerCase();
        const search = window.location.search.toLowerCase();
        if (hash.includes("type=recovery") || search.includes("type=recovery")) {
          const recoveryEmail = data.session?.user?.email;
          if (isGroobeyPlatformAdminEmail(recoveryEmail)) {
            setIsRecoveryFlow(true);
            setNotice("Recovery link verified. Set your new password now.");
          } else {
            void supabase.auth.signOut();
            setError(
              "Password reset is only for platform administrators. Contact platform admin for a new password.",
            );
          }
        }
      }
      setLoading(false);
    })().catch((e) => {
      if (!mounted) return;
      setError(e instanceof Error ? e.message : "Unable to start app.");
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        const recoveryEmail = nextSession?.user?.email;
        if (isGroobeyPlatformAdminEmail(recoveryEmail)) {
          setIsRecoveryFlow(true);
          setNotice("Recovery verified. Please set a new password.");
        } else {
          void supabase.auth.signOut();
          setError(
            "Password reset is only for platform administrators. Contact platform admin for a new password.",
          );
        }
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || isRecoveryFlow) {
      setNextDashboard(null);
      return;
    }
    let cancelled = false;
    setNextDashboard("resolving");
    void (async () => {
      try {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profErr && !String(profErr.message).toLowerCase().includes("column")) {
          await supabase.auth.signOut();
          setSession(null);
          setError("Unable to load profile. Please login again.");
          setNextDashboard(null);
          return;
        }
        if (prof?.is_active === false) {
          await supabase.auth.signOut();
          setSession(null);
          setError("This account is disabled. Contact the platform admin.");
          setNextDashboard(null);
          return;
        }
        const path = await resolvePrimaryDashboard(
          supabase,
          session.user.id,
          parseRoleFromAuthClaims(session.user) ?? session.user.user_metadata?.role,
        );
        if (cancelled) return;
        if (!path) {
          await supabase.auth.signOut();
          setSession(null);
          setError(
            "Could not load your role from database. Please login again. If needed run: npx supabase db push --linked --yes",
          );
          setNextDashboard(null);
          return;
        }
        setNextDashboard(path);
      } catch {
        if (cancelled) return;
        await supabase.auth.signOut();
        setSession(null);
        setError("Login session failed while opening dashboard. Please login again.");
        setNextDashboard(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, isRecoveryFlow]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setAuthAction("password");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const isEmailIdentifier = identifier.includes("@");
    const { data: loginData, error: loginError } = isEmailIdentifier
      ? await supabase.auth.signInWithPassword({ email: identifier, password })
      : await signInWithPhonePassword(identifier, password);

    setAuthAction("");
    if (loginError) {
      setError(friendlyAuthError(loginError.message, platformAdminSignIn));
      return;
    }

    const user = loginData?.user;
    const loggedInUserId = user?.id;
    if (!loggedInUserId) return;

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("user_id", loggedInUserId)
      .maybeSingle();
    if (!profErr && prof?.is_active === false) {
      await supabase.auth.signOut();
      setError("This account is disabled. Contact the platform admin.");
      return;
    }

    const accessAllowed = await verifyPortalRole(
      loggedInUserId,
      loginPortal,
      user ? (parseRoleFromAuthClaims(user) ?? user.user_metadata?.role) : undefined,
      user?.email,
    );
    if (!accessAllowed) {
      await supabase.auth.signOut();
      setError(
        loginPortal === "main_admin" ?
          "Platform admin access is limited to authorized administrator emails."
        : `This account is not allowed for ${loginPortalLabels[loginPortal]} login.`,
      );
      return;
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!platformAdminSignIn) return;
    setError("");
    setNotice("");
    setIsSendingReset(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const resetEmail = String(form.get("resetEmail") || "").trim();
    if (!resetEmail || !resetEmail.includes("@")) {
      setError("Enter your registered email to reset password.");
      setIsSendingReset(false);
      return;
    }
    try {
      const redirectBase = `${window.location.origin}${window.location.pathname}`;
      await sendResetEmail({
        data: {
          email: resetEmail,
          redirectTo: `${redirectBase}?type=recovery`,
        },
      });
      setNotice(
        "If that email is registered, a password reset link was sent. Check inbox/spam and open the latest mail.",
      );
      formElement.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send reset email.");
    } finally {
      setIsSendingReset(false);
    }
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const nextPassword = String(form.get("newPassword") || "");
    const nextConfirmPassword = String(form.get("confirmPassword") || "");
    if (nextPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (nextPassword !== nextConfirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    setIsUpdatingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
    setIsUpdatingPassword(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setIsRecoveryFlow(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setNotice("Password updated successfully. Opening your dashboard…");
  }

  async function signInWithPhonePassword(identifier: string, password: string) {
    let lastError: { message: string } | null = null;
    let successData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null =
      null;
    for (const phone of phoneCandidates(identifier)) {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        phone,
        password,
      });
      if (!loginError) {
        successData = data;
        return { data: successData, error: null };
      }
      lastError = loginError;
      if (!loginError.message.toLowerCase().includes("invalid")) break;
    }
    return { data: successData, error: lastError };
  }

  function portalMatchesRole(portal: LoginPortal, role: AppRole) {
    if (portal === "main_admin") return role === "main_admin" || role === "admin";
    return portal === role;
  }

  async function verifyPortalRole(
    userId: string,
    portal: LoginPortal,
    metadataRole?: unknown,
    userEmail?: string | null,
  ) {
    if (portal === "main_admin" && !isGroobeyPlatformAdminEmail(userEmail)) {
      return false;
    }
    const { data, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesError) {
      if (!isAppRole(metadataRole)) return false;
      return portalMatchesRole(portal, metadataRole);
    }
    const userRoles = new Set<AppRole>((data ?? []).map((entry) => entry.role));
    if (isAppRole(metadataRole)) userRoles.add(metadataRole);
    for (const role of userRoles) {
      if (portalMatchesRole(portal, role)) return true;
    }
    return false;
  }

  if (session && !isRecoveryFlow && nextDashboard !== "resolving" && nextDashboard) {
    return <Navigate to={nextDashboard} replace />;
  }

  if (!session) {
    return (
      <main
        className="groobey-shell groobey-page groobey-page-inset-top w-full min-w-0 overflow-x-hidden overflow-y-auto groobey-scrollbar px-4 py-4 text-foreground sm:px-6 sm:py-6 lg:px-10"
        style={{ "--pointer-x": pointer.x, "--pointer-y": pointer.y } as CSSProperties}
        onPointerMove={(event) => {
          setPointer({
            x: `${Math.round((event.clientX / window.innerWidth) * 100)}%`,
            y: `${Math.round((event.clientY / window.innerHeight) * 100)}%`,
          });
        }}
      >
        <section className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-4">
          <div className="order-2 hidden space-y-5 lg:order-1 lg:block">
            <GroobeyBrandLogo size="xl" withPlate className="max-w-[min(100%,20rem)]" />
            <div className="space-y-4">
              <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-normal text-foreground sm:text-4xl lg:text-5xl">
                Grocery pricing, shop sales, and staff attendance - built for general grocery trade.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Platform admins, shop owners, and staff use separate dashboards after login.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="groobey-card rounded-2xl border border-border p-4">
                <p className="text-xl font-black">Platform Admin</p>
                <p className="text-sm font-semibold text-muted-foreground">Full company control</p>
              </div>
              <div className="groobey-card rounded-2xl border border-border p-4">
                <p className="text-xl font-black">Shop Owner</p>
                <p className="text-sm font-semibold text-muted-foreground">Shops & sales</p>
              </div>
              <div className="groobey-card rounded-2xl border border-border p-4">
                <p className="text-xl font-black">Staff</p>
                <p className="text-sm font-semibold text-muted-foreground">Delivery & attendance</p>
              </div>
            </div>
          </div>
          <div className="order-1 groobey-card rounded-2xl border border-border p-4 sm:p-6 lg:order-2">
            <GroobeyAuthBrand title="Enter TLD Groobey" subtitle="Secure login for your role" />
            <p className="-mt-2 mb-4 text-center text-xs font-semibold leading-relaxed text-muted-foreground lg:hidden">
              Grocery pricing, shops, sales, and staff attendance for general trade.
            </p>
            <div className="space-y-5">
              <form className="space-y-3" onSubmit={handleLogin}>
                <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                  <span>Login as</span>
                  <GroobeySelect
                    value={loginPortal}
                    onValueChange={(v) => setLoginPortal(v as LoginPortal)}
                    options={[
                      ...(platformAdminSignIn ?
                        [{ value: "main_admin" as const, label: "Platform Admin" }]
                      : []),
                      { value: "merchant", label: "Shop Owner" },
                      { value: "order_taker", label: "Order Taker" },
                      { value: "employee", label: "Delivery boy" },
                    ]}
                  />
                </label>
                {!platformAdminSignIn ?
                  <button
                    type="button"
                    className="text-left text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setPlatformAdminSignIn(true);
                      setLoginPortal("main_admin");
                      setError("");
                    }}
                  >
                    Platform administrator sign-in
                  </button>
                : (
                  <button
                    type="button"
                    className="text-left text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setPlatformAdminSignIn(false);
                      setLoginPortal("merchant");
                      setError("");
                    }}
                  >
                    Back to staff / shop owner login
                  </button>
                )}
                <Field name="email" label="Email or mobile number" icon={Mail} required />
                <PasswordField
                  name="password"
                  label="Password"
                  icon={LockKeyhole}
                  required
                  autoComplete="current-password"
                />
                <Button
                  className="h-11 w-full rounded-xl"
                  variant="groobey"
                  type="submit"
                  disabled={authAction === "password"}
                >
                  {authAction === "password" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}{" "}
                  Login
                </Button>
              </form>
              {platformAdminSignIn ?
                <form
                  className="space-y-2 rounded-xl border border-border bg-muted/40 p-3"
                  onSubmit={handleResetPassword}
                >
                  <p className="text-xs font-semibold text-muted-foreground">
                    Forgot password? (platform admin only)
                  </p>
                  <input
                    name="resetEmail"
                    type="email"
                    className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none ring-ring transition focus:ring-2"
                    placeholder="Your platform admin email"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-10 w-full rounded-xl"
                    disabled={isSendingReset}
                  >
                    {isSendingReset ?
                      <Loader2 className="size-4 animate-spin" />
                    : null}{" "}
                    Send reset email
                  </Button>
                </form>
              : (
                <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                  Passwords are set by platform admin when your login is created. Contact platform
                  admin if you need help signing in.
                </p>
              )}
            </div>
            <Message error={error} notice={notice} loading={loading} />
          </div>
        </section>
      </main>
    );
  }

  if (session && isRecoveryFlow) {
    return (
      <main
        className="groobey-shell groobey-page groobey-page-inset-top overflow-x-hidden overflow-y-auto groobey-scrollbar px-4 py-5 text-foreground sm:px-6 lg:px-10"
        style={{ "--pointer-x": pointer.x, "--pointer-y": pointer.y } as CSSProperties}
      >
        <section className="mx-auto grid min-h-[calc(100dvh-2.5rem)] max-w-2xl items-center py-4">
          <div className="groobey-card rounded-2xl border border-border p-6 sm:p-8">
            <GroobeyAuthBrand
              title="Set new password"
              subtitle="Your recovery link is valid - choose a new password to finish reset."
            />
            <form className="grid gap-3" onSubmit={handleUpdatePassword}>
              <PasswordField
                name="newPassword"
                label="New password"
                icon={LockKeyhole}
                required
                autoComplete="new-password"
              />
              <PasswordField
                name="confirmPassword"
                label="Confirm new password"
                icon={LockKeyhole}
                required
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="groobey"
                className="h-11 rounded-xl"
                disabled={isUpdatingPassword}
              >
                {isUpdatingPassword && <Loader2 className="size-4 animate-spin" />} Update password
              </Button>
            </form>
            <Message error={error} notice={notice} loading={loading} />
          </div>
        </section>
      </main>
    );
  }

  if (session && !isRecoveryFlow && nextDashboard === "resolving") {
    return <GroobeyLoadingScreen message="Opening your dashboard…" />;
  }

  if (session && !isRecoveryFlow && nextDashboard === null) {
    return (
      <div className="groobey-page flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 py-8 text-center">
        <p className="text-base font-bold text-foreground">Unable to open dashboard</p>
        <p className="max-w-lg text-sm font-semibold text-muted-foreground">
          {error ||
            "Role/session check failed. Sign out once and login again. If needed, run database migrations."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => {
              setNextDashboard("resolving");
              setError("");
              setNotice("");
            }}
          >
            Retry
          </Button>
          <Button
            variant="groobey"
            className="h-10 rounded-xl"
            onClick={() => void groobeySignOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <GroobeyLoadingScreen message="Still loading…" />;
}
