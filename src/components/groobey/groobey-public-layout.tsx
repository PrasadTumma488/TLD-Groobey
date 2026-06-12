import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { GroobeyPublicAccessGate } from "@/components/groobey/groobey-public-access-gate";
import { GroobeyPublicNavbar } from "@/components/groobey/groobey-public-navbar";
import { GroobeySiteFooter } from "@/components/groobey/groobey-site-footer";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import type { SessionAccess } from "@/lib/groobey-public-access";
import { cn } from "@/lib/utils";

type PublicLayoutProps = {
  children: ReactNode;
  access?: SessionAccess;
  onSignOut?: () => void;
  className?: string;
  showFooter?: boolean;
};

function PublicShell({
  children,
  access,
  onSignOut,
  className,
  showFooter = true,
}: PublicLayoutProps) {
  const session = access ?? {
    audience: "anonymous" as const,
    email: null,
    displayName: null,
    shopSlug: null,
    shopPath: null,
    roles: [],
    primaryDashboard: null,
    dashboards: [],
    canAccessShop: false,
  };

  return (
    <div className="groobey-public-shell">
      <GroobeyPublicNavbar
        access={session}
        onSignOut={onSignOut ?? (() => void groobeySignOut())}
      />
      <div
        className={cn(
          "groobey-public-main mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
          className,
        )}
      >
        {children}
      </div>
      {showFooter ? <GroobeySiteFooter /> : null}
    </div>
  );
}

export function GroobeyPublicLayout(props: PublicLayoutProps) {
  if (props.access !== undefined) {
    return <PublicShell {...props} />;
  }
  return (
    <GroobeyPublicAccessGate>
      {(access) => <PublicShell {...props} access={access} />}
    </GroobeyPublicAccessGate>
  );
}

export function PublicCtaButton({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground shadow-glow hover:brightness-105",
    secondary: "bg-white/90 text-primary ring-1 ring-primary/20 hover:bg-white",
    outline: "border-2 border-border bg-white/70 hover:border-primary/40",
  };
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black transition",
        styles[variant],
      )}
    >
      {children}
    </Link>
  );
}
