import { Printer } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  GroobeyBillEmailSendField,
  SETTLEMENT_BILL_EMAIL_HINT,
} from "@/components/groobey/groobey-bill-email-send-field";
import {
  GroobeySheetDialogBody,
  GroobeySheetDialogContent,
  GroobeySheetDialogFooter,
  GroobeySheetDialogHeader,
} from "@/components/groobey/groobey-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  hideGroobeyBillPreview,
  subscribeGroobeyBillPreview,
  type BillPreviewState,
} from "@/lib/groobey-bill-preview-bridge";
import { resolveShopOwnerEmails } from "@/lib/tldGroobey.functions";
import { cn } from "@/lib/utils";

function printBillDocument(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "Print bill";
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  const cleanup = () => {
    setTimeout(() => iframe.remove(), 400);
  };
  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
  setTimeout(cleanup, 15_000);
}

function measureIframeHeight(iframe: HTMLIFrameElement): number {
  try {
    const doc = iframe.contentDocument;
    if (!doc?.body) return 420;
    const h = Math.max(
      doc.body.scrollHeight,
      doc.documentElement?.scrollHeight ?? 0,
    );
    return Math.min(Math.max(h + 12, 320), 780);
  } catch {
    return 420;
  }
}

export function GroobeyBillPreviewModal() {
  const resolveShopEmailsFn = useServerFn(resolveShopOwnerEmails);
  const [preview, setPreview] = useState<BillPreviewState>(null);
  const [iframeHeight, setIframeHeight] = useState(420);
  const [customerEmail, setCustomerEmail] = useState("");
  const [settlementEmail, setSettlementEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ notice?: string; error?: string }>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => subscribeGroobeyBillPreview(setPreview), []);

  useEffect(() => {
    if (!preview) {
      setCustomerEmail("");
      setSettlementEmail("");
      setFeedback({});
      setSending(false);
      setIframeHeight(420);
      return;
    }
    if (preview.kind === "customer") {
      setCustomerEmail(preview.email?.defaultEmail?.trim() ?? "");
      setSettlementEmail("");
    } else {
      setCustomerEmail("");
      setSettlementEmail(preview.settlementEmail?.defaultEmail?.trim() ?? "");
    }
    setFeedback({});
  }, [preview]);

  useEffect(() => {
    if (preview?.kind !== "merchant" || !preview.settlementEmail) return;
    const preset = preview.settlementEmail.defaultEmail?.trim() ?? "";
    if (preset) return;
    const shopId = preview.settlementEmail.shopId?.trim();
    if (!shopId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token?.trim();
      if (!token || cancelled) return;
      try {
        const result = await resolveShopEmailsFn({
          data: { requesterToken: token, shopIds: [shopId] },
        });
        const resolved = (result as { emails?: Record<string, string> }).emails?.[shopId]?.trim();
        if (resolved && !cancelled) setSettlementEmail(resolved);
      } catch {
        /* leave empty for manual entry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview?.kind, preview?.settlementEmail?.shopId, preview?.settlementEmail?.defaultEmail, resolveShopEmailsFn]);

  useEffect(() => {
    if (!preview) return;
    const id =
      preview.kind === "customer" ?
        "bill-preview-customer-email"
      : "bill-preview-settlement-email";
    const t = window.setTimeout(() => document.getElementById(id)?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [preview?.kind, preview?.html]);

  const close = useCallback(() => {
    hideGroobeyBillPreview();
    setPreview(null);
  }, []);

  const resizePreviewFrame = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) setIframeHeight(measureIframeHeight(iframe));
  }, []);

  const title =
    preview?.kind === "merchant" ? "Settlement bill" : "Bill preview";

  const showCustomerEmail =
    preview?.kind === "customer" && preview.email != null;
  const showSettlementEmail =
    preview?.kind === "merchant" && preview.settlementEmail != null;
  const showEmailBar = showCustomerEmail || showSettlementEmail;

  async function handleSendCustomerEmail() {
    if (!preview?.email) return;
    setSending(true);
    setFeedback({});
    try {
      const result = await preview.email.send(customerEmail.trim());
      setFeedback(result);
    } catch (e) {
      setFeedback({
        error: e instanceof Error ? e.message : "Unable to send bill email.",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSendSettlementEmail() {
    if (!preview?.settlementEmail) return;
    setSending(true);
    setFeedback({});
    try {
      const result = await preview.settlementEmail.send(settlementEmail.trim());
      setFeedback(result);
    } catch (e) {
      setFeedback({
        error: e instanceof Error ? e.message : "Unable to send settlement bill email.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={preview != null} onOpenChange={(open) => !open && close()}>
      <GroobeySheetDialogContent
        className={cn(
          "groobey-sheet-dialog--bill-preview",
          preview?.kind === "merchant" && "groobey-sheet-dialog--wide",
        )}
      >
        {preview ?
          <>
            <GroobeySheetDialogHeader
              title={title}
              onClose={close}
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="groobey"
                  className="h-10 shrink-0 rounded-xl px-3 text-xs font-bold sm:text-sm"
                  onClick={() => printBillDocument(preview.html)}
                >
                  <Printer className="size-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only sm:inline">Print</span>
                </Button>
              }
            />

            <GroobeySheetDialogBody className="groobey-bill-preview-body bg-muted/30 py-3 sm:py-4">
              <iframe
                ref={iframeRef}
                title="Bill preview"
                srcDoc={preview.html}
                onLoad={resizePreviewFrame}
                className="groobey-bill-preview-iframe mx-auto block w-full rounded-xl border border-border bg-white shadow-sm"
                style={{ height: iframeHeight }}
                sandbox="allow-same-origin"
              />
            </GroobeySheetDialogBody>

            {showCustomerEmail ?
              <div className="groobey-bill-preview-email-bar shrink-0 border-t border-border bg-card px-4 py-3 sm:px-5">
                <GroobeyBillEmailSendField
                  layout="bar"
                  label="Customer email"
                  inputId="bill-preview-customer-email"
                  email={customerEmail}
                  onEmailChange={setCustomerEmail}
                  onSend={() => void handleSendCustomerEmail()}
                  sending={sending}
                  sendLabel="Send"
                  sendAriaLabel="Send bill to customer email"
                  feedback={feedback}
                />
              </div>
            : null}

            {showSettlementEmail ?
              <div className="groobey-bill-preview-email-bar groobey-bill-preview-email-bar--settlement shrink-0 border-t border-border bg-amber-50/80 px-4 py-3 sm:px-5">
                <GroobeyBillEmailSendField
                  layout="bar"
                  variant="settlement"
                  label="Shop owner email"
                  hint={SETTLEMENT_BILL_EMAIL_HINT}
                  inputId="bill-preview-settlement-email"
                  email={settlementEmail}
                  onEmailChange={setSettlementEmail}
                  onSend={() => void handleSendSettlementEmail()}
                  sending={sending}
                  sendLabel="Send"
                  sendAriaLabel="Send settlement bill to shop owner email"
                  feedback={feedback}
                  className="border-0 bg-transparent p-0"
                />
              </div>
            : null}

            <GroobeySheetDialogFooter
              onClose={close}
              closeLabel={showEmailBar ? "Close" : "Close bill"}
            />
          </>
        : null}
      </GroobeySheetDialogContent>
    </Dialog>
  );
}
