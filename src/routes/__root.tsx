import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { GroobeyBillPreviewModal } from "@/components/groobey/groobey-bill-preview-modal";
import { GroobeyBrandLogo } from "@/components/groobey/groobey-brand-logo";
import { GroobeyEnvBootstrap } from "@/components/groobey/groobey-env-bootstrap";
import { GroobeyHashScroll } from "@/components/groobey/groobey-hash-scroll";
import { GroobeySiteFooter } from "@/components/groobey/groobey-site-footer";
import { GroobeyWelcomeVoice } from "@/components/groobey/groobey-welcome-voice";
import { PwaRegister } from "@/components/groobey/pwa-register";
import { GROOBEY_FAVICON_VERSION } from "@/lib/groobey-favicon-version";
import { GROOBEY_WELCOME_VOICE_SRC } from "@/lib/groobey-welcome-voice";
import { GROOBEY_WEB_LOGO_PATH } from "@/lib/groobey-brand";
import { GROOBEY_SEO_DEFAULT_DESCRIPTION, GROOBEY_SEO_SITE_NAME, GROOBEY_GOOGLE_SITE_VERIFICATION, groobeyShareImageUrl } from "@/lib/groobey-seo";
import appCss from "../styles.css?url";

const favicon = (file: string) => `${file}?v=${GROOBEY_FAVICON_VERSION}`;

const PWA_THEME_COLOR = "#9ACD32";
const PWA_DESCRIPTION = GROOBEY_SEO_DEFAULT_DESCRIPTION;
const SEO_SHARE_IMAGE = groobeyShareImageUrl();

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
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: `${GROOBEY_SEO_SITE_NAME} - Fresh Groceries Online` },
      { name: "description", content: PWA_DESCRIPTION },
      { name: "application-name", content: GROOBEY_SEO_SITE_NAME },
      { name: "theme-color", content: PWA_THEME_COLOR },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: GROOBEY_SEO_SITE_NAME },
      { name: "format-detection", content: "telephone=no" },
      { name: "author", content: GROOBEY_SEO_SITE_NAME },
      { name: "google-site-verification", content: GROOBEY_GOOGLE_SITE_VERIFICATION },
      { property: "og:title", content: `${GROOBEY_SEO_SITE_NAME} - Fresh Groceries Online` },
      { property: "og:description", content: PWA_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: GROOBEY_SEO_SITE_NAME },
      { property: "og:image", content: SEO_SHARE_IMAGE },
      { property: "og:locale", content: "en_IN" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: SEO_SHARE_IMAGE },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preload", href: GROOBEY_WEB_LOGO_PATH, as: "image", type: "image/png" },
      { rel: "preload", href: GROOBEY_WELCOME_VOICE_SRC, as: "fetch", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: favicon("/favicon.ico"), sizes: "any" },
      { rel: "icon", href: favicon("/favicon-128x128.png"), sizes: "128x128", type: "image/png" },
      { rel: "icon", href: favicon("/favicon-64x64.png"), sizes: "64x64", type: "image/png" },
      { rel: "icon", href: favicon("/favicon-32x32.png"), sizes: "32x32", type: "image/png" },
      { rel: "icon", href: favicon("/favicon-16x16.png"), sizes: "16x16", type: "image/png" },
      { rel: "icon", href: favicon("/tld-groobey-web-logo.png"), sizes: "512x512", type: "image/png" },
      { rel: "apple-touch-icon", href: favicon("/apple-touch-icon.png"), sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content={GROOBEY_GOOGLE_SITE_VERIFICATION} />
        <link rel="icon" href={favicon("/favicon.ico")} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={favicon("/favicon-32x32.png")} />
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
      <GroobeyBillPreviewModal />
    </GroobeyEnvBootstrap>
  );
}
