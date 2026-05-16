import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2, Mail } from "lucide-react";
import { useCallback, useState } from "react";

import { getBillEmailDeliveryInfo } from "@/lib/tldGroobey.functions";

export function GroobeyBillEmailStatus({ accessToken }: { accessToken: string | undefined }) {
  const fetchInfo = useServerFn(getBillEmailDeliveryInfo);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchInfo>> | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setErr("Sign in to view mail status.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const row = await fetchInfo({ data: { requesterToken: accessToken } });
      setData(row);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load mail status.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchInfo]);

  return (
    <details
      className="rounded-xl border border-border bg-muted/25 text-sm"
      onToggle={(e) => {
        const el = e.target as HTMLDetailsElement;
        setOpen(el.open);
        if (el.open && !loading && (!data || err)) void load();
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-bold text-foreground [&::-webkit-details-marker]:hidden">
        <Mail className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">How bill email works</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
        />
      </summary>
      <div className="space-y-2 border-t border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        <p className="text-foreground">
          The address you type for the customer is the <strong>only</strong> recipient. The bill is sent as a{" "}
          <strong>PDF attachment</strong> with a short email body (helps avoid spam folders).
        </p>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Local dev:</strong> bill mail uses the same Resend rules as
          production. Put <code className="text-foreground">RESEND_FROM_EMAIL</code> (verified domain) in{" "}
          <code className="text-foreground">.env</code> and restart <code className="text-foreground">npm run dev</code>{" "}
          after you change it — the API key alone is not enough for customer inboxes. The server also accepts{" "}
          <code className="text-foreground">VITE_RESEND_FROM_EMAIL</code> for the From line only (never put the API key
          in a <code className="text-foreground">VITE_</code> variable).
        </p>
        {loading ?
          <p className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Checking server mail settings…
          </p>
        : err ?
          <p className="text-destructive">{err}</p>
        : data ?
          <ul className="list-inside list-disc space-y-1">
            <li>
              Resend API key:{" "}
              <span className={data.apiKeyPresent ? "text-emerald-700" : "text-destructive"}>
                {data.apiKeyPresent ? "set" : "missing (bills cannot send)"}
              </span>
            </li>
            <li>
              RESEND_FROM_EMAIL on this server:{" "}
              <span className={data.resendFromEnvSet ? "text-emerald-700" : "text-amber-800"}>
                {data.resendFromEnvSet ?
                  "set (or RESEND_MAIL_FROM / EMAIL_FROM)"
                : "not set — still on Resend default test sender"}
              </span>
            </li>
            <li>
              Send-from domain:{" "}
              {data.canReachCustomerInboxes ?
                <span className="text-emerald-700">
                  verified ({data.fromMasked}
                  {data.fromDomain ? ` · @${data.fromDomain}` : ""})
                </span>
              : <span className="text-amber-800">
                  test / sandbox ({data.fromMasked}
                  {data.fromDomain ? ` · @${data.fromDomain}` : ""})
                </span>}
            </li>
            {data.fromDomain && data.fromDomain !== "tldgroobey.in" && data.fromDomain.includes("groobey") ?
              <li className="text-amber-800">
                Resend shows <strong>tldgroobey.in</strong> as verified — use{" "}
                <code className="text-foreground">@tldgroobey.in</code> in RESEND_FROM_EMAIL, not @groobey.in.
              </li>
            : null}
            <li>
              Customer inboxes:{" "}
              {data.canReachCustomerInboxes ?
                <span className="text-emerald-700">OK — bills deliver to the email you enter</span>
              : <span className="text-amber-800">
                  Set RESEND_FROM_EMAIL to an address on a domain you verified at resend.com/domains
                </span>}
            </li>
            {data.redirectToSet ?
              <li className="text-muted-foreground">
                RESEND_REDIRECT_TO is set (used for some non-bill mail only; customer bills are not
                redirected there).
              </li>
            : null}
          </ul>
        : (
          <button
            type="button"
            className="text-primary underline"
            onClick={() => void load()}
          >
            Load mail status
          </button>
        )}
      </div>
    </details>
  );
}
