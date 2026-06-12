/** Inline SVG icons for transactional emails (no background plates). */
const ICON_COLOR = "#166534";

const svgAttrs = `xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-3px;margin-right:4px;"`;

function iconSvg(inner: string): string {
  return `<svg ${svgAttrs}>${inner}</svg>`;
}

export const GROOBEY_EMAIL_ICONS = {
  receipt: iconSvg(
    `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>`,
  ),
  user: iconSvg(`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`),
  file: iconSvg(`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>`),
  phone: iconSvg(
    `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`,
  ),
  mail: iconSvg(`<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`),
  whatsapp: iconSvg(
    `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`,
  ),
  users: iconSvg(
    `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  ),
  instagram: iconSvg(
    `<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>`,
  ),
} as const;

export function groobeyEmailInlineMeta(parts: { icon: string; text: string }[]): string {
  const cells = parts
    .map(
      (p) =>
        `<span style="display:inline-block;margin:0 14px 0 0;font-size:14px;font-weight:700;color:#0a0a0a;white-space:nowrap;">${p.icon}${p.text}</span>`,
    )
    .join("");
  return `<p style="margin:0;font-size:14px;line-height:1.5;">${cells}</p>`;
}

export function groobeyEmailContactChip(icon: string, href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;font-size:12px;font-weight:700;color:#166534;text-decoration:none;white-space:nowrap;">${icon}${label}</a>`;
}
