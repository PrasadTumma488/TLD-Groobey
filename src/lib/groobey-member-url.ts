/** URL-safe slug for a member's personal shop path (`/my/:slug`). */
export function slugifyDisplayName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "account";
}

export function memberShopPath(slug: string): `/my/${string}` {
  return `/my/${slug}`;
}

export function isMemberShopPath(path: string): boolean {
  return path === "/shop" || path.startsWith("/my/");
}

/** Pick a unique slug by appending -2, -3, … when needed. */
export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  const maxBase = Math.max(1, 48 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}

/** Slug for `/my/:slug` - DB value first, then name/email fallback. */
export function resolveMemberShopSlug(
  shopSlug: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const fromDb = shopSlug?.trim();
  if (fromDb) return fromDb;
  return slugifyDisplayName(displayName || email?.split("@")[0] || "account");
}

export function resolveMemberShopPath(
  canAccessShop: boolean,
  shopSlug: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (!canAccessShop) return null;
  return memberShopPath(resolveMemberShopSlug(shopSlug, displayName, email));
}
