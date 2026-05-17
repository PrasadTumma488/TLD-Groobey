/** Only these emails may receive platform admin access (bootstrap + dashboard). */
export const GROOBEY_PLATFORM_ADMIN_EMAILS = [
  "thiru.build@gmail.com",
  "tummadurgaprasad520@gmail.com",
] as const;

export function isGroobeyPlatformAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return GROOBEY_PLATFORM_ADMIN_EMAILS.some((allowed) => allowed === normalized);
}
