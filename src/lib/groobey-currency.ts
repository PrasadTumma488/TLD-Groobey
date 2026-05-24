/** Indian Rupee - use these helpers so files never get mojibake (â‚¹). */

export const INR = "\u20B9";

export const EM_DASH = "-";

/** Middle dot for compact inline separators (avoids mojibake like Â·). */
export const MIDDLE_DOT = "\u00B7";

/** Bullet for plain-text lists (e.g. confirm dialogs). */
export const BULLET = "\u2022";

export function formatInr(amount: number): string {
  return `${INR}${Math.round(amount)}`;
}

/** PDF standard fonts (Helvetica / WinAnsi) cannot render ₹ - use in server PDF output only. */
export function formatInrForPdf(amount: number): string {
  return `Rs.${Math.round(amount)}`;
}

/** Replace characters WinAnsi Helvetica cannot encode (e.g. ₹ U+20B9). Keeps Latin-1 text. */
export function sanitizeTextForStandardPdfFont(text: string): string {
  return text.replace(/\u20b9/g, "Rs.").replace(/\u2014/g, "-");
}

/** For HTML bill totals (print-safe numeric entity). */
export function formatInrHtml(amount: number): string {
  return `&#8377;${Math.round(amount)}`;
}
