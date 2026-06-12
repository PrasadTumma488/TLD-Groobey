import { Link, useRouterState } from "@tanstack/react-router";

import { GroobeySectionLink } from "@/components/groobey/groobey-section-link";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Shield,
  Store,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { GroobeyBrandLogo } from "@/components/groobey/groobey-brand-logo";
import type { DashboardPath } from "@/lib/groobey-dashboard-path";
import {
  dashboardLabel,
  dashboardNavLabel,
  memberNavLabel,
  memberNavPath,
  type SessionAccess,
} from "@/lib/groobey-public-access";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", hash: undefined, label: "Home", match: "home" as const },
  { to: "/", hash: "categories", label: "Categories", match: "categories" as const },
  { to: "/", hash: "how-it-works", label: "How it works", match: "learn" as const },
  { to: "/", hash: "contact", label: "Contact", match: "contact" as const },
  { to: "/shop", hash: undefined, label: "Shop", match: "shop" as const, portal: true },
] as const;

function navHash(value: string | undefined) {
  return value?.replace(/^#+/, "") ?? "";
}

function isHashMatch(current: string, target: string) {
  return navHash(current) === navHash(target);
}

export function GroobeyPublicNavbar({
  access,
  onSignOut,
}: {
  access: SessionAccess;
  onSignOut?: () => void;
}) {
  const { pathname, hash } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }),
  });
  const [open, setOpen] = useState(false);
  const signedIn = access.audience === "member";
  const staffPanels = access.dashboards.filter((p) => p !== "/shop");
  const displayName = access.displayName ?? "Account";
  const accountPath = memberNavPath(access);

  const visibleLinks = NAV_LINKS.filter((link) => !("portal" in link) || SHOW_CUSTOMER_PORTAL);
  const shopHref = signedIn && access.shopPath ? access.shopPath : "/shop";

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function isActive(match: (typeof NAV_LINKS)[number]["match"]) {
    if (match === "home") return pathname === "/" && !navHash(hash);
    if (match === "shop") return pathname === "/shop" || pathname.startsWith("/my/");
    if (match === "categories") return pathname === "/" && isHashMatch(hash, "categories");
    if (match === "learn") return pathname === "/" && isHashMatch(hash, "how-it-works");
    if (match === "contact") return pathname === "/" && isHashMatch(hash, "contact");
    return false;
  }

  return (
    <>
      {open ?
        <button
          type="button"
          className="groobey-nav-backdrop lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      : null}

      <div className="groobey-floating-nav-wrap">
        <header className={cn("groobey-floating-nav", open && "groobey-floating-nav--open")}>
          <div className="groobey-floating-nav-bar">
            <GroobeySectionLink to="/" className="groobey-nav-brand" onClick={() => setOpen(false)}>
              <GroobeyBrandLogo size="md" className="groobey-nav-logo" />
            </GroobeySectionLink>

            <nav className="groobey-nav-track" aria-label="Main">
              {visibleLinks.map((link) => (
                <NavTrackLink
                  key={link.match}
                  to={link.match === "shop" ? shopHref : link.to}
                  hash={link.hash}
                  label={link.label}
                  active={isActive(link.match)}
                />
              ))}
            </nav>

            <div className="groobey-nav-actions">
              {signedIn ?
                <>
                  {staffPanels.map((panel) => (
                    <RoleNavLink key={panel} panel={panel} pathname={pathname} />
                  ))}
                  {SHOW_CUSTOMER_PORTAL ?
                    <Link
                      to="/profile"
                      className={cn(
                        "groobey-nav-login",
                        pathname === "/profile" && "groobey-nav-login--active",
                      )}
                    >
                      Profile
                    </Link>
                  : null}
                  <UserNavLink
                    to={accountPath}
                    pathname={pathname}
                    displayName={displayName}
                    title={memberNavLabel(access)}
                  />
                  {onSignOut ?
                    <button
                      type="button"
                      className="groobey-nav-logout-btn"
                      aria-label="Sign out"
                      onClick={onSignOut}
                    >
                      <LogOut className="size-4" aria-hidden />
                    </button>
                  : null}
                </>
              : SHOW_CUSTOMER_PORTAL ?
                <>
                  <Link
                    to="/login"
                    className={cn(
                      "groobey-nav-login",
                      pathname === "/login" && "groobey-nav-login--active",
                    )}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className={cn(
                      "groobey-nav-cta",
                      pathname === "/signup" && "groobey-nav-cta--active",
                    )}
                  >
                    Register
                  </Link>
                </>
              : null}
            </div>

            <button
              type="button"
              className="groobey-nav-menu-btn"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ?
                <X className="size-6" />
              : <span className="groobey-nav-menu-lines" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              }
            </button>
          </div>

          {open ?
            <div className="groobey-nav-mobile-panel">
              <nav className="groobey-nav-mobile-list" aria-label="Mobile">
                {visibleLinks.map((link) => (
                  <GroobeySectionLink
                    key={link.match}
                    to={link.match === "shop" ? shopHref : link.to}
                    hash={link.hash}
                    className={cn(
                      "groobey-nav-mobile-link",
                      isActive(link.match) && "groobey-nav-mobile-link--active",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </GroobeySectionLink>
                ))}
              </nav>

              <div className="groobey-nav-mobile-actions">
                {signedIn ?
                  <>
                    {staffPanels.map((panel) => (
                      <Link
                        key={panel}
                        to={panel}
                        className="groobey-nav-mobile-link groobey-nav-mobile-link--muted"
                        onClick={() => setOpen(false)}
                      >
                        {dashboardLabel(panel)}
                      </Link>
                    ))}
                    {SHOW_CUSTOMER_PORTAL ?
                      <Link
                        to="/profile"
                        className={cn(
                          "groobey-nav-mobile-link groobey-nav-mobile-link--muted",
                          pathname === "/profile" && "groobey-nav-mobile-link--active",
                        )}
                        onClick={() => setOpen(false)}
                      >
                        Profile
                      </Link>
                    : null}
                    <Link
                      to={accountPath}
                      className={cn(
                        "groobey-nav-mobile-link groobey-nav-mobile-link--muted",
                        pathname === accountPath && "groobey-nav-mobile-link--active",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {displayName}
                    </Link>
                    {onSignOut ?
                      <button
                        type="button"
                        className="groobey-nav-mobile-link groobey-nav-mobile-link--muted"
                        onClick={() => {
                          setOpen(false);
                          onSignOut();
                        }}
                      >
                        Sign out
                      </button>
                    : null}
                  </>
                : SHOW_CUSTOMER_PORTAL ?
                  <>
                    <Link
                      to="/login"
                      className={cn(
                        "groobey-nav-mobile-link groobey-nav-mobile-link--muted",
                        pathname === "/login" && "groobey-nav-mobile-link--auth-active",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/signup"
                      className={cn(
                        "groobey-nav-mobile-link groobey-nav-mobile-link--cta",
                        pathname === "/signup" && "groobey-nav-mobile-link--auth-active",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      Register
                    </Link>
                  </>
                : null}
              </div>
            </div>
          : null}
        </header>
      </div>
    </>
  );
}

function NavTrackLink({
  to,
  hash,
  label,
  active,
}: {
  to: string;
  hash?: string;
  label: string;
  active: boolean;
}) {
  return (
    <GroobeySectionLink
      to={to}
      hash={hash}
      className={cn("groobey-nav-track-link", active && "groobey-nav-track-link--active")}
    >
      {label}
    </GroobeySectionLink>
  );
}

function panelNavIcon(panel: DashboardPath) {
  switch (panel) {
    case "/platform-admin":
      return Shield;
    case "/staff":
      return Truck;
    case "/shop-owner":
      return Store;
    case "/orders":
      return ClipboardList;
    default:
      return LayoutDashboard;
  }
}

function RoleNavLink({ panel, pathname }: { panel: DashboardPath; pathname: string }) {
  const Icon = panelNavIcon(panel);
  const active = pathname === panel || pathname.startsWith(`${panel}/`);

  return (
    <Link
      to={panel}
      className={cn("groobey-nav-role-link", active && "groobey-nav-role-link--active")}
      title={dashboardLabel(panel)}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{dashboardNavLabel(panel)}</span>
    </Link>
  );
}

function UserNavLink({
  to,
  pathname,
  displayName,
  title,
}: {
  to: string;
  pathname: string;
  displayName: string;
  title: string;
}) {
  const active = pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={cn("groobey-nav-user-chip", active && "groobey-nav-user-chip--active")}
      title={title}
    >
      <User className="size-4 shrink-0" aria-hidden />
      <span className="groobey-nav-user-chip-name">{displayName}</span>
    </Link>
  );
}
