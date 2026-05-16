import { Loader2, Mail, Printer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  hideGroobeyBillPreview,
  subscribeGroobeyBillPreview,
  type BillPreviewState,
} from "@/lib/groobey-bill-preview-bridge";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (!doc?.body) return 360;
    const h = Math.max(
      doc.body.scrollHeight,
      doc.documentElement?.scrollHeight ?? 0,
    );
    return Math.min(Math.max(h + 8, 280), 720);
  } catch {
    return 360;
  }
}

export function GroobeyBillPreviewModal() {
  const [preview, setPreview] = useState<BillPreviewState>(null);
  const [iframeHeight, setIframeHeight] = useState(360);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ notice?: string; error?: string }>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => subscribeGroobeyBillPreview(setPreview), []);

  useEffect(() => {
    if (!preview) {
      setEmail("");
      setFeedback({});
      setSending(false);
      setIframeHeight(360);
      return;
    }
    setEmail(preview.email?.defaultEmail?.trim() ?? "");
    setFeedback({});
  }, [preview]);

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

  const showEmail =
    preview?.kind === "customer" && preview.email != null;

  async function handleSendEmail() {
    if (!preview?.email) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setFeedback({ error: "Enter the customer's email address." });
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setFeedback({ error: "Enter a valid customer email address." });
      return;
    }
    setSending(true);
    setFeedback({});
    try {
      const result = await preview.email.send(trimmed);
      setFeedback(result);
    } catch (e) {
      setFeedback({
        error: e instanceof Error ? e.message : "Unable to send bill email.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={preview != null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,840px)] max-w-none flex-col gap-0 overflow-hidden border-border p-0 sm:rounded-xl [&>button:last-child]:hidden",
          preview?.kind === "merchant" ?
            "w-[min(calc(100vw-1rem),54rem)]"
          : "w-[min(calc(100vw-1rem),38rem)]",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-2.5 py-1.5">
          <DialogTitle className="min-w-0 flex-1 truncate text-xs font-bold">{title}</DialogTitle>
          <Button
            type="button"
            size="sm"
            variant="groobey"
            className="h-7 shrink-0 rounded-md px-2 text-[11px]"
            onClick={() => preview && printBillDocument(preview.html)}
          >
            <Printer className="size-3" />
            Print
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0 rounded-md px-2 text-[11px]"
            onClick={close}
          >
            <X className="size-3" />
          </Button>
        </div>

        {preview ?
          <>
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-2 py-2">
              <iframe
                ref={iframeRef}
                title="Bill preview"
                srcDoc={preview.html}
                onLoad={resizePreviewFrame}
                className="mx-auto block w-full max-w-full rounded-md border border-border bg-white shadow-sm"
                style={{ height: iframeHeight }}
                sandbox="allow-same-origin"
              />
            </div>

            {showEmail ?
              <div className="shrink-0 space-y-1.5 border-t border-border bg-card px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Email bill
                </p>
                <div className="flex gap-1.5">
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="Customer email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-8 min-w-0 flex-1 text-xs"
                    disabled={sending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSendEmail();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="groobey"
                    className="h-8 shrink-0 rounded-md px-2 text-[11px]"
                    disabled={sending}
                    onClick={() => void handleSendEmail()}
                  >
                    {sending ?
                      <Loader2 className="size-3.5 animate-spin" />
                    : <>
                        <Mail className="size-3" />
                        Send
                      </>
                    }
                  </Button>
                </div>
                {feedback.notice ?
                  <p className="text-[11px] font-medium text-emerald-700">{feedback.notice}</p>
                : null}
                {feedback.error ?
                  <p className="text-[11px] font-medium text-destructive">{feedback.error}</p>
                : null}
              </div>
            : null}
          </>
        : null}
      </DialogContent>
    </Dialog>
  );
}
