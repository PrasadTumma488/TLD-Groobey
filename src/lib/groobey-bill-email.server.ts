import {
  GROOBEY_APP_NAME,
  GROOBEY_BRAND,
  GROOBEY_CUSTOMER_THANK_YOU,
  groobeyCustomerBillThankYouEmailHtml,
  groobeyBillThankYouPlainText,
  GROOBEY_LOGO_DISPLAY,
  GROOBEY_PRODUCT_NAME,
} from "@/lib/groobey-brand";
import { getGroobeyBillLogoDataUrl } from "@/lib/groobey-bill-logo.server";

export type BillDeliveryEmailParams = {
  shopName: string;
  billTitle: string;
  billNumber?: string | null;
  customerEmail?: string;
  /** Customer bills are Groobey-branded; merchant bills may mention the shop. */
  billKind?: "customer" | "merchant";
};

/** Short transactional body - bill detail is in the PDF attachment (better deliverability). */
export function buildBillDeliveryEmail(params: BillDeliveryEmailParams): {
  html: string;
  text: string;
} {
  const isCustomer = params.billKind !== "merchant";
  const shop = params.shopName.trim() || "your shop";
  const billRef = params.billNumber?.trim();
  const subtitle = isCustomer ? GROOBEY_APP_NAME : `from ${shop}`;
  const logo = getGroobeyBillLogoDataUrl();
  const logoW = GROOBEY_LOGO_DISPLAY.billMaxWidthPx;
  const logoH = GROOBEY_LOGO_DISPLAY.billHeightPx;

  const logoCell =
    logo ?
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#ffffff;padding:12px 16px;border-radius:10px;border:2px solid ${GROOBEY_BRAND.lime};">
          <img src="${logo}" alt="${escapeHtml(GROOBEY_APP_NAME)}" height="${logoH}" style="display:block;height:${logoH}px;width:auto;max-width:${logoW}px;object-fit:contain;" />
        </td>
      </tr></table>`
    : `<p style="margin:0;font-size:18px;font-weight:800;color:${GROOBEY_BRAND.lime};letter-spacing:0.08em;">TLD GROOBEY</p>`;

  const billIdRow =
    billRef ?
      `<tr>
        <td style="padding:0 28px 12px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Bill ID</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0a0a0a;font-family:Consolas,Monaco,monospace;">${escapeHtml(billRef)}</p>
        </td>
      </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(params.billTitle)} - ${escapeHtml(shop)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f2;font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:16px;overflow:hidden;border:1px solid #d1d5db;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${GROOBEY_BRAND.blackSoft} 0%,#1f1f1f 100%);padding:24px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;width:1%;white-space:nowrap;">${logoCell}</td>
                <td style="vertical-align:middle;padding-left:20px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${GROOBEY_BRAND.lime};">TLD Groobey</p>
                  <p style="margin:6px 0 0;font-size:22px;font-weight:800;line-height:1.25;color:#ffffff;">${escapeHtml(params.billTitle)}</p>
                  <p style="margin:6px 0 0;font-size:15px;font-weight:600;color:${GROOBEY_BRAND.silver};">${escapeHtml(subtitle)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${billIdRow}
        <tr>
          <td style="background:#ffffff;padding:28px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#374151;">
              Your itemized bill is attached as a <strong style="color:#0a0a0a;">PDF document</strong>.
              Open the attachment to view products, quantities, and the total amount.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#166534;">PDF attachment</p>
                  <p style="margin:6px 0 0;font-size:13px;line-height:1.45;color:#15803d;">
                    Look for <strong>Groobey-Bill${billRef ? escapeHtml(`-${billRef}`) : ""}.pdf</strong> in this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${
          isCustomer ?
            `<tr>
          <td style="background:#ffffff;padding:8px 28px 24px;">
            ${groobeyCustomerBillThankYouEmailHtml()}
          </td>
        </tr>`
          : ""
        }
        <tr>
          <td style="background:#f9fafb;padding:18px 28px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
              ${
                isCustomer ?
                  `${escapeHtml(GROOBEY_CUSTOMER_THANK_YOU.message)}<br/><br/>`
                : ""
              }
              Transactional message from ${escapeHtml(GROOBEY_APP_NAME)}${isCustomer ? "" : ` · ${escapeHtml(GROOBEY_PRODUCT_NAME)}`}<br/>
              Please keep this email for your records.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text =
    `${GROOBEY_APP_NAME} - ${params.billTitle}${isCustomer ? "" : ` from ${shop}`}\n` +
    (billRef ? `Bill ID: ${billRef}\n` : "") +
    `\nYour bill is attached as a PDF (Groobey-Bill${billRef ? `-${billRef}` : ""}.pdf).\n` +
    `Open the attachment to view line items and the total.\n\n` +
    (isCustomer ? `${groobeyBillThankYouPlainText("customer")}\n\n` : "") +
    (isCustomer ? `- ${GROOBEY_APP_NAME}\n` : `- ${GROOBEY_PRODUCT_NAME}\n`);

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
