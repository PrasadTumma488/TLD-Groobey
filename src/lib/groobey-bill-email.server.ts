import {
  GROOBEY_APP_NAME,
  GROOBEY_BRAND,
  GROOBEY_LOGO_DISPLAY,
  GROOBEY_PRODUCT_NAME,
} from "@/lib/groobey-brand";
import { groobeyBillContactEmailHtml, groobeyBillContactPlainLines } from "@/lib/groobey-bill-contact";
import { GROOBEY_EMAIL_ICONS, groobeyEmailInlineMeta } from "@/lib/groobey-email-icons";
import { getGroobeyBillLogoDataUrl } from "@/lib/groobey-bill-logo.server";

export type BillDeliveryEmailParams = {
  shopName: string;
  billTitle: string;
  billNumber?: string | null;
  customerEmail?: string;
  customerName?: string | null;
  /** Customer bills are Groobey-branded; merchant bills may mention the shop. */
  billKind?: "customer" | "merchant";
};

/** Short transactional body - bill detail is in the PDF attachment. */
export function buildBillDeliveryEmail(params: BillDeliveryEmailParams): {
  html: string;
  text: string;
} {
  const isCustomer = params.billKind !== "merchant";
  const shop = params.shopName.trim() || "your shop";
  const billRef = params.billNumber?.trim();
  const logo = getGroobeyBillLogoDataUrl();
  const logoW = GROOBEY_LOGO_DISPLAY.billMaxWidthPx;
  const logoH = GROOBEY_LOGO_DISPLAY.billHeightPx;

  const logoCell =
    logo ?
      `<img src="${logo}" alt="${escapeHtml(GROOBEY_APP_NAME)}" height="${logoH}" style="display:block;margin:0 auto;height:${logoH}px;width:auto;max-width:${logoW}px;object-fit:contain;" />`
    : `<p style="margin:0;font-size:18px;font-weight:800;color:${GROOBEY_BRAND.lime};letter-spacing:0.08em;text-align:center;">TLD GROOBEY</p>`;

  const customerName = params.customerName?.trim();
  const metaParts = [
    billRef ? { icon: GROOBEY_EMAIL_ICONS.receipt, text: escapeHtml(billRef) } : null,
    customerName ? { icon: GROOBEY_EMAIL_ICONS.user, text: escapeHtml(customerName) } : null,
  ].filter(Boolean) as { icon: string; text: string }[];

  const billMetaRow =
    metaParts.length ?
      `<tr>
        <td style="padding:0 24px 16px;background:#ffffff;">
          ${groobeyEmailInlineMeta(metaParts)}
        </td>
      </tr>`
    : "";

  const pdfName = `Groobey-Bill${billRef ? escapeHtml(`-${billRef}`) : ""}.pdf`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(params.billTitle)} - ${escapeHtml(shop)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f2;font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f2;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#ffffff;">
        <tr>
          <td style="padding:28px 24px 12px;text-align:center;background:#ffffff;">
            ${logoCell}
          </td>
        </tr>
        ${billMetaRow}
        <tr>
          <td style="padding:8px 24px 20px;background:#ffffff;">
            <p style="margin:0;font-size:15px;line-height:1.55;color:#374151;">
              ${GROOBEY_EMAIL_ICONS.file}
              Your bill is attached as <strong style="color:#0a0a0a;">${pdfName}</strong>.
              Open it to view items and your order total.
            </p>
            ${isCustomer ? groobeyBillContactEmailHtml() : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 18px;border-top:1px solid #f3f4f6;background:#ffffff;">
            <p style="margin:0;font-size:11px;line-height:1.45;color:#9ca3af;text-align:center;">
              ${escapeHtml(GROOBEY_APP_NAME)}${isCustomer ? "" : ` · ${escapeHtml(GROOBEY_PRODUCT_NAME)}`}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const contactText =
    isCustomer ?
      `\n${groobeyBillContactPlainLines().join("\n")}\n`
    : "";
  const text =
    `${GROOBEY_APP_NAME} - ${params.billTitle}${isCustomer ? "" : ` from ${shop}`}\n` +
    (billRef ? `Bill: ${billRef}\n` : "") +
    (customerName ? `Customer: ${customerName}\n` : "") +
    `\nYour bill is attached as a PDF (${pdfName}).\n` +
    contactText +
    (isCustomer ? `\n- ${GROOBEY_APP_NAME}\n` : `\n- ${GROOBEY_PRODUCT_NAME}\n`);

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
