import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import { GROOBEY_EMAIL_ICONS, groobeyEmailContactChip } from "@/lib/groobey-email-icons";
import { GROOBEY_SITE_CONTACT, groobeyWhatsAppOrderUrl } from "@/lib/groobey-site-contact";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-text contact lines for PDF footers and email text bodies. */
export function groobeyBillContactPlainLines(): string[] {
  const c = GROOBEY_SITE_CONTACT;
  const lines: string[] = [];
  if (c.phone.trim()) lines.push(`Phone: ${c.phone.trim()}`);
  if (c.email.trim()) lines.push(`Email: ${c.email.trim()}`);
  if (c.phone.trim()) lines.push(`WhatsApp: ${groobeyWhatsAppOrderUrl(c.phone)}`);
  if (c.whatsappGroupUrl.trim()) {
    lines.push(`${c.whatsappGroupLabel}: ${c.whatsappGroupUrl.trim()}`);
  }
  if (c.instagramUrl.trim()) {
    lines.push(`Instagram: ${c.instagramUrl.trim()}`);
  }
  return lines;
}

type ContactLink = { href: string; label: string };

function billContactLinks(): ContactLink[] {
  const c = GROOBEY_SITE_CONTACT;
  const wa = groobeyWhatsAppOrderUrl(c.phone);
  const links: ContactLink[] = [];
  if (c.phone.trim()) {
    links.push({ href: `tel:${c.phone.replace(/\s/g, "")}`, label: c.phone.trim() });
  }
  if (c.email.trim()) {
    links.push({ href: `mailto:${c.email}`, label: c.email.trim() });
  }
  if (c.phone.trim()) {
    links.push({ href: wa, label: "WhatsApp" });
  }
  if (c.whatsappGroupUrl.trim()) {
    links.push({ href: c.whatsappGroupUrl.trim(), label: c.whatsappGroupLabel });
  }
  if (c.instagramUrl.trim()) {
    links.push({ href: c.instagramUrl.trim(), label: c.instagramHandle });
  }
  return links;
}

/** Compact contact links on print / preview HTML bills. */
export function groobeyBillContactHtml(): string {
  const links = billContactLinks();
  if (!links.length) return "";

  const chips = links
    .map(
      (link) =>
        `<a class="groobey-bill-contact-link" href="${esc(link.href)}">${esc(link.label)}</a>`,
    )
    .join("");

  return `<section class="groobey-bill-contact" aria-label="Contact ${esc(GROOBEY_APP_NAME)}">
    <div class="groobey-bill-contact-grid">${chips}</div>
  </section>`;
}

/** Compact horizontal contact chips for bill emails. */
export function groobeyBillContactEmailHtml(): string {
  const c = GROOBEY_SITE_CONTACT;
  const wa = groobeyWhatsAppOrderUrl(c.phone);
  const chips: string[] = [];

  if (c.phone.trim()) {
    chips.push(
      groobeyEmailContactChip(
        GROOBEY_EMAIL_ICONS.phone,
        `tel:${esc(c.phone.replace(/\s/g, ""))}`,
        esc(c.phone),
      ),
    );
  }
  if (c.email.trim()) {
    chips.push(
      groobeyEmailContactChip(GROOBEY_EMAIL_ICONS.mail, `mailto:${esc(c.email)}`, esc(c.email)),
    );
  }
  if (c.phone.trim()) {
    chips.push(groobeyEmailContactChip(GROOBEY_EMAIL_ICONS.whatsapp, esc(wa), "WhatsApp"));
  }
  if (c.whatsappGroupUrl.trim()) {
    chips.push(
      groobeyEmailContactChip(
        GROOBEY_EMAIL_ICONS.users,
        esc(c.whatsappGroupUrl),
        esc(c.whatsappGroupLabel),
      ),
    );
  }
  if (c.instagramUrl.trim()) {
    chips.push(
      groobeyEmailContactChip(
        GROOBEY_EMAIL_ICONS.instagram,
        esc(c.instagramUrl),
        esc(c.instagramHandle),
      ),
    );
  }

  if (!chips.length) return "";

  return `<div style="margin:12px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;">${chips.join("")}</div>`;
}
