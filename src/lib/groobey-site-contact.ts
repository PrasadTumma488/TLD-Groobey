/** Public contact - edit here; footer icons use these values. */
export const GROOBEY_SITE_CONTACT = {
  email: "tummadurgaprasad520@gmail.com",
  phone: "+91 72074 74455",
  whatsappGroupUrl: "https://chat.whatsapp.com/GlsTCe7WiBnF5mhnKbbiP8",
  whatsappGroupLabel: "WhatsApp group",
  instagramUrl: "https://www.instagram.com/thetld2026",
  instagramHandle: "The TLD 2026",
} as const;

/** Direct chat link for placing orders and order updates via WhatsApp. */
export function groobeyWhatsAppOrderUrl(
  phone: string = GROOBEY_SITE_CONTACT.phone,
): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "https://wa.me/";
}

export function hasGroobeySiteContact(
  contact: typeof GROOBEY_SITE_CONTACT = GROOBEY_SITE_CONTACT,
): boolean {
  return Boolean(
    contact.email.trim() ||
      contact.phone.trim() ||
      contact.whatsappGroupUrl.trim() ||
      contact.instagramUrl.trim(),
  );
}
