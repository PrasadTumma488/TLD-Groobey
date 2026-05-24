import type { BillKind } from "@/lib/groobey-bill-template";

export type BillPreviewEmailResult = { notice?: string; error?: string };

export type BillPreviewEmailOptions = {
  defaultEmail?: string;
  /** When pre-fill is empty, modal may resolve inbox from shop owner Groobey profile. */
  shopId?: string;
  send: (customerEmail: string) => Promise<BillPreviewEmailResult>;
};

export type BillPreviewShowOptions = {
  /** Customer retail bill email (customer kind). */
  email?: BillPreviewEmailOptions;
  /** Settlement / internal bill email to shop owner (merchant kind). */
  settlementEmail?: BillPreviewEmailOptions;
};

export type BillPreviewState = {
  html: string;
  kind: BillKind;
  email?: BillPreviewEmailOptions;
  settlementEmail?: BillPreviewEmailOptions;
} | null;

type Listener = (state: BillPreviewState) => void;

let listener: Listener | null = null;

export function subscribeGroobeyBillPreview(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function showGroobeyBillPreview(
  html: string,
  kind: BillKind = "customer",
  options?: BillPreviewShowOptions,
): void {
  listener?.({
    html,
    kind,
    email: options?.email,
    settlementEmail: options?.settlementEmail,
  });
}

export function hideGroobeyBillPreview(): void {
  listener?.(null);
}
