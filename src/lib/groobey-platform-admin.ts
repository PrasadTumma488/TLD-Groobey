/**
 * Full platform owners - both emails have identical rights:
 * shops, staff, catalog, orders, billing, and all admin APIs.
 */
export const GROOBEY_PLATFORM_ADMIN_EMAILS = [
  "thiru.build@gmail.com",
  "tummadurgaprasad520@gmail.com",
] as const;

export function isGroobeyPlatformAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return GROOBEY_PLATFORM_ADMIN_EMAILS.some((allowed) => allowed === normalized);
}

/** Same as isGroobeyPlatformAdminEmail - both listed owners control the entire platform. */
export function hasFullPlatformOwnerAccess(email: string | undefined | null): boolean {
  return isGroobeyPlatformAdminEmail(email);
}
