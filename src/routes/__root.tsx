import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import { GroobeyBillPreviewModal } from "@/components/groobey/groobey-bill-preview-modal";
import { GroobeyBrandLogo } from "@/components/groobey/groobey-brand-logo";
import { PwaRegister } from "@/components/groobey/pwa-register";
import { GROOBEY_FAVICON_VERSION } from "@/lib/groobey-favicon-version";
import {
  buildPublicEnvInlineScript,
  publicSupabaseMetaTags,
} from "@/lib/groobey-public-env";
import appCss from "../styles.css?url";

const favicon = (file: string) => `${file}?v=${GROOBEY_FAVICON_VERSION}`;

const PWA_THEME_COLOR = "#9ACD32";
const PWA_DESCRIPTION =
  "Groobey merchant hub for grocery retail — shop owners, staff, order takers, and platform admin.";

function NotFoundComponent() {
  return (
    <div className="groobey-shell flex min-h-screen items-center justify-center px-4">
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
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no",
      },
      { title: "Groobey Merchant Hub" },
      { name: "description", content: PWA_DESCRIPTION },
      { name: "application-name", content: "Groobey" },
      { name: "theme-color", content: PWA_THEME_COLOR },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Groobey" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "Groobey Merchant Hub" },
      { property: "og:description", content: PWA_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: favicon("/favicon.ico"), sizes: "any" },
      { rel: "icon", href: favicon("/favicon-32x32.png"), sizes: "32x32", type: "image/png" },
      { rel: "icon", href: favicon("/favicon-16x16.png"), sizes: "16x16", type: "image/png" },
      { rel: "apple-touch-icon", href: favicon("/apple-touch-icon.png"), sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const supabaseMeta = publicSupabaseMetaTags();
  return (
    <html lang="en">
      <head>
        {supabaseMeta.url ?
          <meta name="groobey-supabase-url" content={supabaseMeta.url} />
        : null}
        {supabaseMeta.publishableKey ?
          <meta
            name="groobey-supabase-publishable-key"
            content={supabaseMeta.publishableKey}
          />
        : null}
        <link rel="icon" href={favicon("/favicon.ico")} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={favicon("/favicon-32x32.png")} />
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: buildPublicEnvInlineScript(),
          }}
        />
        {children}
        <PwaRegister />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <GroobeyBillPreviewModal />
    </>
  );
}
