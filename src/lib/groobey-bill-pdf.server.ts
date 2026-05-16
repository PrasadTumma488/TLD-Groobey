import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type {
  GroobeyBillMetaRow,
  GroobeyBillTableColumn,
  GroobeyBillTableRow,
} from "@/lib/groobey-bill-template";
import { getGroobeyBillLogoPngBytes } from "@/lib/groobey-bill-logo.server";
import {
  GROOBEY_APP_NAME,
  groobeyBillThankYouCopy,
  GROOBEY_LOGO_DISPLAY,
  GROOBEY_PRODUCT_NAME,
} from "@/lib/groobey-brand";
import {
  formatInrForPdf,
  sanitizeTextForStandardPdfFont,
} from "@/lib/groobey-currency";

export type GroobeyBillPdfParams = {
  billTitle: string;
  meta: GroobeyBillMetaRow[];
  columns: GroobeyBillTableColumn[];
  rows: GroobeyBillTableRow[];
  totalInr: number;
  billNumber?: string | null;
  marginNote?: string;
  billKind?: "customer" | "merchant";
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const LIME = rgb(154 / 255, 205 / 255, 50 / 255);
const BLACK = rgb(0.08, 0.08, 0.08);
const GRAY = rgb(0.35, 0.35, 0.35);
const BORDER = rgb(0.88, 0.88, 0.88);

function pdfText(text: string): string {
  return sanitizeTextForStandardPdfFont(text);
}

function sanitizePdfFilenamePart(raw: string): string {
  return raw.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "bill";
}

export function groobeyBillPdfFilename(billNumber?: string | null): string {
  const id = billNumber?.trim();
  return id ? `Groobey-Bill-${sanitizePdfFilenamePart(id)}.pdf` : "Groobey-Bill.pdf";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfText(text).split(/\s+/u).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  color = BLACK,
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let cy = y;
  for (const ln of lines) {
    page.drawText(ln, { x, y: cy, size, font, color });
    cy -= size + 4;
  }
  return cy;
}

/** Build a print-ready bill PDF (server-only). */
export async function buildGroobeyBillPdfBuffer(params: GroobeyBillPdfParams): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const logoBytes = getGroobeyBillLogoPngBytes();
  if (logoBytes?.length) {
    try {
      const img = await doc.embedPng(logoBytes);
      const displayH = GROOBEY_LOGO_DISPLAY.billHeightPx;
      const logoH = Math.min(displayH, img.height);
      const logoW = Math.min(
        GROOBEY_LOGO_DISPLAY.billMaxWidthPx,
        (img.width / img.height) * logoH,
      );
      const platePad = GROOBEY_LOGO_DISPLAY.billPlatePaddingPx;
      const plateW = logoW + platePad * 2;
      const plateH = logoH + platePad * 2;
      const plateX = (PAGE_W - plateW) / 2;
      const plateY = y - plateH;
      const centerX = PAGE_W / 2;

      page.drawRectangle({
        x: plateX,
        y: plateY,
        width: plateW,
        height: plateH,
        color: rgb(1, 1, 1),
        borderColor: rgb(146 / 255, 200 / 255, 46 / 255),
        borderWidth: 1.5,
      });
      page.drawImage(img, {
        x: plateX + platePad,
        y: plateY + platePad,
        width: logoW,
        height: logoH,
      });

      const brandLine = pdfText(GROOBEY_APP_NAME.toUpperCase());
      const brandW = fontBold.widthOfTextAtSize(brandLine, 12);
      page.drawText(brandLine, {
        x: centerX - brandW / 2,
        y: plateY - 18,
        size: 12,
        font: fontBold,
        color: BLACK,
      });
      const tagline =
        params.billKind === "merchant" ?
          "Grocery trade · Internal settlement"
        : "Grocery · Your bill";
      const taglinePdf = pdfText(tagline);
      const tagW = font.widthOfTextAtSize(taglinePdf, 10);
      page.drawText(taglinePdf, {
        x: centerX - tagW / 2,
        y: plateY - 32,
        size: 10,
        font,
        color: GRAY,
      });
      y = plateY - 48;
    } catch {
      y -= 8;
    }
  }

  const titlePdf = pdfText(params.billTitle);
  const titleW = fontBold.widthOfTextAtSize(titlePdf, 22);
  const titleX =
    params.billKind === "customer" ? (PAGE_W - titleW) / 2 : MARGIN;
  page.drawText(titlePdf, {
    x: titleX,
    y: y - 4,
    size: 22,
    font: fontBold,
    color: BLACK,
  });
  y -= 36;

  for (const row of params.meta.filter((m) => m.value.trim())) {
    page.drawText(pdfText(`${row.label}:`), {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: BLACK,
    });
    y = drawWrapped(page, pdfText(row.value), MARGIN + 88, y, font, 10, PAGE_W - MARGIN * 2 - 88) - 4;
    if (row.subValue?.trim()) {
      y = drawWrapped(
        page,
        pdfText(row.subValue.trim()),
        MARGIN + 88,
        y - 2,
        font,
        9,
        PAGE_W - MARGIN * 2 - 88,
        GRAY,
      ) - 2;
    }
  }

  if (params.marginNote?.trim()) {
    y = drawWrapped(page, pdfText(params.marginNote), MARGIN, y - 6, font, 10, PAGE_W - MARGIN * 2, GRAY) - 8;
  }

  y -= 10;
  const colCount = params.columns.length;
  const denseTable = colCount > 4;
  const tableW = PAGE_W - MARGIN * 2;
  const colW = tableW / colCount;
  const rowH = denseTable ? 20 : 22;
  const headerSize = denseTable ? 9 : 10;
  const cellSize = denseTable ? 8 : 9;
  const headerY = y - rowH;

  page.drawRectangle({
    x: MARGIN,
    y: headerY,
    width: tableW,
    height: rowH,
    color: LIME,
  });

  params.columns.forEach((col, i) => {
    const label = pdfText(col.label);
    const tw = fontBold.widthOfTextAtSize(label, headerSize);
    const cellX = MARGIN + i * colW;
    const tx =
      col.align === "right" ? cellX + colW - tw - 6 : cellX + 6;
    page.drawText(label, { x: tx, y: headerY + 7, size: headerSize, font: fontBold, color: BLACK });
  });

  y = headerY - 2;

  for (const row of params.rows) {
    const pad = 6;
    const maxCellW = colW - pad * 2;
    let lineCount = 1;
    for (const col of params.columns) {
      const raw = row[col.id];
      const val = pdfText(raw == null ? "" : String(raw));
      if (font.widthOfTextAtSize(val, cellSize) > maxCellW) {
        lineCount = Math.max(lineCount, wrapText(val, font, cellSize, maxCellW).length);
      }
    }
    const thisRowH = rowH + (lineCount - 1) * (cellSize + 3);
    if (y - thisRowH < MARGIN + 80) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    y -= thisRowH;
    page.drawLine({
      start: { x: MARGIN, y: y + thisRowH },
      end: { x: MARGIN + tableW, y: y + thisRowH },
      thickness: 0.5,
      color: BORDER,
    });
    params.columns.forEach((col, i) => {
      const raw = row[col.id];
      const val = pdfText(raw == null ? "" : String(raw));
      const cellX = MARGIN + i * colW;
      const tw = font.widthOfTextAtSize(val, cellSize);
      if (tw > maxCellW) {
        const lines = wrapText(val, font, cellSize, maxCellW);
        let cy = y + 7 + (lines.length - 1) * (cellSize + 2);
        for (const ln of lines) {
          const tx = col.align === "right" ? cellX + colW - font.widthOfTextAtSize(ln, cellSize) - pad : cellX + pad;
          page.drawText(ln, { x: tx, y: cy, size: cellSize, font, color: BLACK });
          cy -= cellSize + 2;
        }
      } else {
        const tx = col.align === "right" ? cellX + colW - tw - pad : cellX + pad;
        page.drawText(val, { x: tx, y: y + 7, size: cellSize, font, color: BLACK });
      }
    });
  }

  y -= 16;
  const totalLabel = pdfText(`Total: ${formatInrForPdf(params.totalInr)}`);
  const totalW = fontBold.widthOfTextAtSize(totalLabel, 14);
  page.drawText(totalLabel, {
    x: PAGE_W - MARGIN - totalW,
    y,
    size: 14,
    font: fontBold,
    color: BLACK,
  });
  y -= 28;

  {
    const kind = params.billKind ?? "customer";
    const copy = groobeyBillThankYouCopy(kind);
    const thanksH = 56;
    const boxW = PAGE_W - MARGIN * 2;
    const boxY = y - thanksH;
    const isMerchant = kind === "merchant";
    page.drawRectangle({
      x: MARGIN,
      y: boxY,
      width: boxW,
      height: thanksH,
      color: isMerchant ? rgb(1, 0.97, 0.94) : rgb(0.94, 0.99, 0.91),
      borderColor: isMerchant ? rgb(234 / 255, 88 / 255, 12 / 255) : LIME,
      borderWidth: 2,
    });
    const thanksTitle = pdfText(copy.title);
    const thanksTitleW = fontBold.widthOfTextAtSize(thanksTitle, 13);
    page.drawText(thanksTitle, {
      x: (PAGE_W - thanksTitleW) / 2,
      y: boxY + thanksH - 20,
      size: 13,
      font: fontBold,
      color: BLACK,
    });
    y = drawWrapped(
      page,
      pdfText(copy.message),
      MARGIN + 14,
      boxY + thanksH - 34,
      font,
      9,
      boxW - 28,
      GRAY,
    );
    y -= 16;
  }

  const footer = pdfText(
    params.billKind === "customer" ?
      GROOBEY_APP_NAME
    : `${GROOBEY_APP_NAME} · ${GROOBEY_PRODUCT_NAME}`,
  );
  const fw = font.widthOfTextAtSize(footer, 9);
  page.drawText(footer, {
    x: (PAGE_W - fw) / 2,
    y: MARGIN - 8,
    size: 9,
    font,
    color: GRAY,
  });

  return doc.save();
}
