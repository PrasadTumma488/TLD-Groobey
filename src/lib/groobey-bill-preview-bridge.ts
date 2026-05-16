import type { BillKind } from "@/lib/groobey-bill-template";

export type BillPreviewEmailResult = { notice?: string; error?: string };

export type BillPreviewEmailOptions = {
  defaultEmail?: string;
  send: (customerEmail: string) => Promise<BillPreviewEmailResult>;
};

export type BillPreviewShowOptions = {
  email?: BillPreviewEmailOptions;
};

export type BillPreviewState = {
  html: string;
  kind: BillKind;
  email?: BillPreviewEmailOptions;
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
  listener?.({ html, kind, email: options?.email });
}

export function hideGroobeyBillPreview(): void {
  listener?.(null);
}
