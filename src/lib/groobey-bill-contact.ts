import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import { GROOBEY_EMAIL_ICONS } from "@/lib/groobey-email-icons";
import { GROOBEY_SITE_CONTACT, groobeyWhatsAppOrderUrl } from "@/lib/groobey-site-contact";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ContactRow = { icon: string; href: string; label: string };

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

function billContactRows(): ContactRow[] {
  const c = GROOBEY_SITE_CONTACT;
  const wa = groobeyWhatsAppOrderUrl(c.phone);
  const rows: ContactRow[] = [];
  if (c.phone.trim()) {
    rows.push({
      icon: GROOBEY_EMAIL_ICONS.phone,
      href: `tel:${c.phone.replace(/\s/g, "")}`,
      label: c.phone.trim(),
    });
  }
  if (c.email.trim()) {
    rows.push({
      icon: GROOBEY_EMAIL_ICONS.mail,
      href: `mailto:${c.email}`,
      label: c.email.trim(),
    });
  }
  if (c.phone.trim()) {
    rows.push({ icon: GROOBEY_EMAIL_ICONS.whatsapp, href: wa, label: "WhatsApp" });
  }
  if (c.whatsappGroupUrl.trim()) {
    rows.push({
      icon: GROOBEY_EMAIL_ICONS.users,
      href: c.whatsappGroupUrl.trim(),
      label: c.whatsappGroupLabel,
    });
  }
  if (c.instagramUrl.trim()) {
    rows.push({
      icon: GROOBEY_EMAIL_ICONS.instagram,
      href: c.instagramUrl.trim(),
      label: c.instagramHandle,
    });
  }
  return rows;
}

function contactListHtml(rows: ContactRow[], linkClass: string): string {
  if (!rows.length) return "";
  const items = rows
    .map(
      (row) =>
        `<li class="groobey-bill-contact-item">
          <span class="groobey-bill-contact-icon" aria-hidden="true">${row.icon}</span>
          <a class="${linkClass}" href="${esc(row.href)}">${esc(row.label)}</a>
        </li>`,
    )
    .join("");
  return `<ul class="groobey-bill-contact-list">${items}</ul>`;
}

/** Contact block with icons on print / preview HTML bills. */
export function groobeyBillContactHtml(): string {
  const rows = billContactRows();
  if (!rows.length) return "";

  return `<section class="groobey-bill-contact" aria-label="Contact ${esc(GROOBEY_APP_NAME)}">
    <p class="groobey-bill-contact-title">Get in touch</p>
    ${contactListHtml(rows, "groobey-bill-contact-link")}
  </section>`;
}

/** Contact rows with icons for bill emails (no pill/chip styling). */
export function groobeyBillContactEmailHtml(): string {
  const rows = billContactRows();
  if (!rows.length) return "";

  const items = rows
    .map(
      (row) =>
        `<tr>
          <td style="width:22px;padding:4px 0;vertical-align:middle;">${row.icon}</td>
          <td style="padding:4px 0;vertical-align:middle;">
            <a href="${esc(row.href)}" style="font-size:13px;font-weight:700;color:#166534;text-decoration:none;">${esc(row.label)}</a>
          </td>
        </tr>`,
    )
    .join("");

  return `<div style="margin:16px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Get in touch</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${items}</table>
  </div>`;
}
