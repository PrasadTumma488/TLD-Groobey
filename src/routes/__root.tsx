import { lazy, Suspense } from "react";
import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { GroobeyBrandLogo } from "@/components/groobey/groobey-brand-logo";
import { GroobeyDocumentHead } from "@/components/groobey/groobey-document-head";
import { GroobeyEnvBootstrap } from "@/components/groobey/groobey-env-bootstrap";
import { GroobeyHashScroll } from "@/components/groobey/groobey-hash-scroll";
import { GroobeySiteFooter } from "@/components/groobey/groobey-site-footer";
import { GroobeyWelcomeVoice } from "@/components/groobey/groobey-welcome-voice";
import { PwaRegister } from "@/components/groobey/pwa-register";
import { GROOBEY_FAVICON_VERSION } from "@/lib/groobey-favicon-version";
import { GROOBEY_WEB_LOGO_PATH } from "@/lib/groobey-brand";
import appCss from "../styles.css?url";

const GroobeyBillPreviewModal = lazy(async () => {
  const mod = await import("@/components/groobey/groobey-bill-preview-modal");
  return { default: mod.GroobeyBillPreviewModal };
});

const favicon = (file: string) => `${file}?v=${GROOBEY_FAVICON_VERSION}`;

const PWA_THEME_COLOR = "#9ACD32";

function NotFoundComponent() {
  return (
    <div className="groobey-shell groobey-page flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="max-w-md text-center">
        <GroobeyBrandLogo size="lg" withPlate className="mx-auto mb-6" />
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
        <GroobeySiteFooter />
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { name: "theme-color", content: PWA_THEME_COLOR },
      { name: "application-name", content: "TLD Groobey" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "TLD Groobey" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "preload", href: GROOBEY_WEB_LOGO_PATH, as: "image", type: "image/png" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: favicon("/favicon-128x128.png"), sizes: "128x128", type: "image/png" },
      { rel: "icon", href: favicon("/favicon-64x64.png"), sizes: "64x64", type: "image/png" },
      { rel: "icon", href: favicon("/favicon-16x16.png"), sizes: "16x16", type: "image/png" },
      { rel: "icon", href: favicon("/tld-groobey-web-logo.png"), sizes: "512x512", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <GroobeyDocumentHead />
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <PwaRegister />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <GroobeyEnvBootstrap>
      <GroobeyHashScroll />
      <GroobeyWelcomeVoice />
      <Outlet />
      <Suspense fallback={null}>
        <GroobeyBillPreviewModal />
      </Suspense>
    </GroobeyEnvBootstrap>
  );
}
