import { GROOBEY_APP_NAME, GROOBEY_WEB_LOGO_PATH } from "@/lib/groobey-brand";
import { GROOBEY_SITE_CONTACT } from "@/lib/groobey-site-contact";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

/** Default customer-facing meta description (home + fallback). */
export const GROOBEY_SEO_DEFAULT_DESCRIPTION =
  "Order fresh groceries online with TLD Groobey — rice, dal, vegetables, fruits, combos & doorstep delivery.";

/** Legacy / internal product name — avoid in public SEO titles. */
export const GROOBEY_SEO_SITE_NAME = GROOBEY_APP_NAME;

/** Google Search Console — HTML meta + DNS TXT value (same token). */
export const GROOBEY_GOOGLE_SITE_VERIFICATION = "kvy-uAjz9f6iFiDr4ZWlUZ32Ze0FCSwC5t7f796nr8Q";

const DEFAULT_SITE_ORIGIN = "https://tldgroobey.in";

function trimOrigin(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

/** Canonical site origin for SEO (env override, else request origin, else production default). */
export function groobeySiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  const fromEnv =
    trimOrigin(process.env.SITE_URL) ||
    trimOrigin(process.env.VITE_SITE_URL) ||
    trimOrigin(process.env.SUPABASE_SITE_URL) ||
    trimOrigin(process.env.VITE_SUPABASE_SITE_URL);
  return fromEnv ?? DEFAULT_SITE_ORIGIN;
}

export function groobeyAbsoluteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${groobeySiteOrigin()}${normalized}`;
}

export function groobeyShareImageUrl(): string {
  return groobeyAbsoluteUrl(GROOBEY_WEB_LOGO_PATH.split("?")[0] ?? GROOBEY_WEB_LOGO_PATH);
}

export type GroobeyPageSeo = {
  title: string;
  description?: string;
  /** Path only, e.g. `/shop` */
  path?: string;
  noindex?: boolean;
};

/** TanStack Router `head()` meta + canonical for a public page. */
export function groobeyPageHead(seo: GroobeyPageSeo) {
  const description = seo.description?.trim() || GROOBEY_SEO_DEFAULT_DESCRIPTION;
  const canonical = groobeyAbsoluteUrl(seo.path ?? "/");
  const image = groobeyShareImageUrl();

  return {
    meta: [
      { title: seo.title },
      { name: "description", content: description },
      { property: "og:title", content: seo.title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:site_name", content: GROOBEY_SEO_SITE_NAME },
      { property: "og:image", content: image },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_IN" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: seo.title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      ...(seo.noindex ? [{ name: "robots", content: "noindex, nofollow" }] : [{ name: "robots", content: "index, follow" }]),
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

export function groobeyNoIndexHead(title: string) {
  return groobeyPageHead({
    title,
    description: GROOBEY_SEO_DEFAULT_DESCRIPTION,
    noindex: true,
  });
}

/** Public URLs for XML sitemap (customer-facing only). */
export function groobeyPublicSitemapPaths(): string[] {
  const paths = ["/"];
  if (SHOW_CUSTOMER_PORTAL) {
    paths.push("/shop", "/login", "/signup");
  }
  return paths;
}

/** JSON-LD for the home page (GroceryStore + WebSite). */
export function groobeyHomeJsonLd(): Record<string, unknown> {
  const origin = groobeySiteOrigin();
  const phoneDigits = GROOBEY_SITE_CONTACT.phone.replace(/\D/g, "");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: GROOBEY_SEO_SITE_NAME,
        description: GROOBEY_SEO_DEFAULT_DESCRIPTION,
        inLanguage: "en-IN",
        publisher: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "GroceryStore",
        "@id": `${origin}/#organization`,
        name: GROOBEY_SEO_SITE_NAME,
        url: origin,
        image: groobeyShareImageUrl(),
        description: GROOBEY_SEO_DEFAULT_DESCRIPTION,
        email: GROOBEY_SITE_CONTACT.email,
        ...(phoneDigits ? { telephone: `+${phoneDigits}` } : {}),
        sameAs: [GROOBEY_SITE_CONTACT.instagramUrl, GROOBEY_SITE_CONTACT.whatsappGroupUrl].filter(Boolean),
      },
    ],
  };
}

export function groobeyRobotsTxt(): string {
  const sitemap = groobeyAbsoluteUrl("/sitemap.xml");
  return `# TLD Groobey
User-agent: *
Allow: /

Disallow: /platform-admin
Disallow: /staff
Disallow: /orders
Disallow: /shop-owner
Disallow: /profile
Disallow: /my/
Disallow: /team/

Sitemap: ${sitemap}
`;
}

export function groobeySitemapXml(): string {
  const origin = groobeySiteOrigin();
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = groobeyPublicSitemapPaths()
    .map(
      (path) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${path === "/" ? "weekly" : "daily"}</changefreq>
    <priority>${path === "/" ? "1.0" : path === "/shop" ? "0.9" : "0.6"}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
