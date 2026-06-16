import { GROOBEY_APP_NAME, GROOBEY_WEB_LOGO_PATH } from "@/lib/groobey-brand";
import { HOME_CATEGORIES } from "@/lib/groobey-home-categories";
import { GROOBEY_SITE_CONTACT } from "@/lib/groobey-site-contact";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";
import { SHOP_COMBOS_CATEGORY_ID } from "@/lib/groobey-shop-browse";

/** Default customer-facing meta description (home + fallback). */
export const GROOBEY_SEO_DEFAULT_DESCRIPTION =
  "Order fresh groceries online with TLD Groobey — rice, dal, vegetables, fruits, combos & doorstep delivery.";

/** Legacy / internal product name — avoid in public SEO titles. */
export const GROOBEY_SEO_SITE_NAME = GROOBEY_APP_NAME;

/** Google Search Console — HTML meta + DNS TXT value (same token). */
export const GROOBEY_GOOGLE_SITE_VERIFICATION = "kvy-uAjz9f6iFiDr4ZWlUZ32Ze0FCSwC5t7f796nr8Q";

/** Default home page title (view-source + fallbacks). */
export const GROOBEY_SEO_DEFAULT_TITLE = `${GROOBEY_SEO_SITE_NAME} - Fresh Groceries Online`;

/** Social share image path (generated at build — see scripts/generate-pwa-icons.mjs). */
export const GROOBEY_OG_IMAGE_PATH = "/og-image.png";

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
  return groobeyAbsoluteUrl(GROOBEY_OG_IMAGE_PATH);
}

/** Optional Google Analytics 4 measurement ID (e.g. G-XXXXXXXX). */
export function groobeyGaMeasurementId(): string | undefined {
  const id =
    process.env.GROOBEY_GA_MEASUREMENT_ID?.trim() ||
    process.env.VITE_GA_MEASUREMENT_ID?.trim();
  return id || undefined;
}

export type GroobeyPageSeo = {
  title: string;
  description?: string;
  /** Path only, e.g. `/shop` or `/shop?category=groceries` */
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
      { property: "og:image:alt", content: `${GROOBEY_SEO_SITE_NAME} logo` },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_IN" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: seo.title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      ...(seo.noindex ?
        [{ name: "robots", content: "noindex, nofollow" }]
      : [{ name: "robots", content: "index, follow, max-image-preview:large" }]),
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "sitemap", type: "application/xml", href: groobeyAbsoluteUrl("/sitemap.xml") },
    ],
  };
}

export function groobeyNoIndexHead(title: string) {
  return groobeyPageHead({
    title,
    description: GROOBEY_SEO_DEFAULT_DESCRIPTION,
    noindex: true,
  });
}

export function groobeyWebPageHeadScripts(jsonLd: Record<string, unknown>) {
  return [
    {
      type: "application/ld+json",
      children: JSON.stringify(jsonLd),
    },
  ];
}

type SitemapEntry = {
  path: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
};

/** Public URLs for XML sitemap (customer-facing only). */
export function groobeyPublicSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "weekly", priority: 1 },
    { path: "/about", changefreq: "monthly", priority: 0.85 },
    { path: "/privacy", changefreq: "monthly", priority: 0.4 },
    { path: "/terms", changefreq: "monthly", priority: 0.4 },
  ];

  if (SHOW_CUSTOMER_PORTAL) {
    entries.push(
      { path: "/shop", changefreq: "daily", priority: 0.95 },
      { path: "/login", changefreq: "monthly", priority: 0.5 },
      { path: "/signup", changefreq: "monthly", priority: 0.5 },
    );
    for (const category of HOME_CATEGORIES) {
      entries.push({
        path: `/shop?category=${encodeURIComponent(category.id)}`,
        changefreq: "daily",
        priority: 0.8,
      });
    }
    entries.push({
      path: `/shop?category=${SHOP_COMBOS_CATEGORY_ID}`,
      changefreq: "daily",
      priority: 0.8,
    });
  }

  return entries;
}

/** @deprecated use groobeyPublicSitemapEntries */
export function groobeyPublicSitemapPaths(): string[] {
  return groobeyPublicSitemapEntries().map((entry) => entry.path);
}

function organizationJsonLd(origin: string) {
  const phoneDigits = GROOBEY_SITE_CONTACT.phone.replace(/\D/g, "");
  return {
    "@type": "GroceryStore",
    "@id": `${origin}/#organization`,
    name: GROOBEY_SEO_SITE_NAME,
    url: origin,
    logo: groobeyShareImageUrl(),
    image: groobeyShareImageUrl(),
    description: GROOBEY_SEO_DEFAULT_DESCRIPTION,
    email: GROOBEY_SITE_CONTACT.email,
    ...(phoneDigits ? { telephone: `+${phoneDigits}` } : {}),
    sameAs: [GROOBEY_SITE_CONTACT.instagramUrl, GROOBEY_SITE_CONTACT.whatsappGroupUrl].filter(
      Boolean,
    ),
  };
}

/** JSON-LD for the home page. */
export function groobeyHomeJsonLd(): Record<string, unknown> {
  const origin = groobeySiteOrigin();

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
      organizationJsonLd(origin),
      {
        "@type": "WebPage",
        "@id": `${origin}/#webpage`,
        url: origin,
        name: `${GROOBEY_SEO_SITE_NAME} - Fresh Groceries Online`,
        description: GROOBEY_SEO_DEFAULT_DESCRIPTION,
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#organization` },
        inLanguage: "en-IN",
      },
    ],
  };
}

/** JSON-LD for the About page. */
export function groobeyAboutJsonLd(): Record<string, unknown> {
  const origin = groobeySiteOrigin();
  const aboutUrl = `${origin}/about`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      {
        "@type": "AboutPage",
        "@id": `${aboutUrl}/#webpage`,
        url: aboutUrl,
        name: "About TLD Groobey",
        description:
          "Learn about TLD Groobey online grocery store — fresh staples, produce, combos, and doorstep delivery.",
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#organization` },
        inLanguage: "en-IN",
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function groobeySitemapXml(): string {
  const origin = groobeySiteOrigin();
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = groobeyPublicSitemapEntries()
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(`${origin}${entry.path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(2)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
