/** Delivery staff emails that auto-receive the employee role on sign-in (when service role is configured). */
export const GROOBEY_KNOWN_DELIVERY_EMAILS = ["mktailor3177@gmail.com"] as const;

export function isGroobeyKnownDeliveryEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return GROOBEY_KNOWN_DELIVERY_EMAILS.some((allowed) => allowed === normalized);
}
