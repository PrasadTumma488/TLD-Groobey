import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

export type SitemapLink = { label: string; href: string; hash?: string; description?: string };

export type SitemapSection = { title: string; links: SitemapLink[] };

export type FooterLegalLink = {
  label: string;
  href: string;
  hash?: string;
  external?: boolean;
};

/** Six slots in row-major order for desktop footer (2 rows × 3 columns). */
export function footerDesktopQuickLinkGrid(): (SitemapLink | null)[] {
  const home: SitemapLink = { label: "Home", href: "/" };
  const categories: SitemapLink = { label: "Categories", href: "/", hash: "categories" };
  const howItWorks: SitemapLink = { label: "How it works", href: "/", hash: "how-it-works" };
  const contact: SitemapLink = { label: "Contact", href: "/", hash: "contact" };

  if (SHOW_CUSTOMER_PORTAL) {
    return [
      home,
      categories,
      { label: "Shop", href: "/shop" },
      howItWorks,
      contact,
      { label: "Sign in", href: "/login" },
    ];
  }

  return [home, categories, howItWorks, contact, null, null];
}

/** Flat footer nav links (no duplicate columns). */
export function footerQuickLinks(): SitemapLink[] {
  const seen = new Set<string>();
  const out: SitemapLink[] = [];
  for (const section of publicSitemapSections()) {
    for (const link of section.links) {
      const key = `${link.href}|${link.hash ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(link);
    }
  }
  return out;
}

export function footerLegalLinks(): FooterLegalLink[] {
  return [
    { label: "Privacy", href: "/", hash: "how-it-works" },
    { label: "Terms", href: "/", hash: "how-it-works" },
    { label: "Contact", href: "/", hash: "contact" },
  ];
}

/** Customer-facing footer sitemap only - no staff or admin links. */
export function publicSitemapSections(): SitemapSection[] {
  const shop: SitemapLink[] = [{ label: "Home", href: "/" }];
  if (SHOW_CUSTOMER_PORTAL) {
    shop.push(
      { label: "Order groceries", href: "/shop", description: "Sign in required" },
      { label: "Customer sign in", href: "/login" },
      { label: "Create account", href: "/signup" },
    );
  }
  return [
    { title: "Shop online", links: shop },
    {
      title: "Learn",
      links: [
        { label: "Shop by category", href: "/", hash: "categories" },
        { label: "How ordering works", href: "/", hash: "how-it-works" },
        { label: "Contact us", href: "/", hash: "contact" },
      ],
    },
    {
      title: "Account",
      links: SHOW_CUSTOMER_PORTAL ?
        [
          { label: "Register", href: "/signup" },
          { label: "Sign in", href: "/login" },
        ]
      : [{ label: "Home", href: "/" }],
    },
  ];
}
