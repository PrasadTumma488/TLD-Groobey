/**
 * Write sitemap.xml and robots.txt into public/ at build time.
 * Ensures SEO files are served from static output even if Nitro server routes are unavailable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

const DEFAULT_ORIGIN = "https://tldgroobey.in";
const SHOW_CUSTOMER_PORTAL = true;

const HOME_CATEGORY_IDS = [
  "groceries",
  "vegetables",
  "fruits",
  "pickles-non-veg",
  "papads-crisps",
  "veg-non-veg",
];

function siteOrigin() {
  const fromEnv =
    process.env.SITE_URL?.trim().replace(/\/+$/, "") ||
    process.env.VITE_SITE_URL?.trim().replace(/\/+$/, "") ||
    process.env.SUPABASE_SITE_URL?.trim().replace(/\/+$/, "") ||
    process.env.VITE_SUPABASE_SITE_URL?.trim().replace(/\/+$/, "");
  return fromEnv || DEFAULT_ORIGIN;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapEntries() {
  const entries = [
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
    for (const id of HOME_CATEGORY_IDS) {
      entries.push({
        path: `/shop?category=${encodeURIComponent(id)}`,
        changefreq: "daily",
        priority: 0.8,
      });
    }
    entries.push({
      path: "/shop?category=combos",
      changefreq: "daily",
      priority: 0.8,
    });
  }

  return entries;
}

function sitemapXml(origin) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = sitemapEntries()
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

function robotsTxt(origin) {
  const sitemap = `${origin}/sitemap.xml`;
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

const origin = siteOrigin();
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemapXml(origin), "utf8");
fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt(origin), "utf8");
console.log(`[seo:static] Wrote sitemap.xml and robots.txt for ${origin}`);
