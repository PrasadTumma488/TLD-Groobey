/** Resend env helpers - server-only (process.env + project `.env` files). */

import { readKeyFromEnvFiles } from "@/lib/platform-admin-bootstrap.server";

/**
 * Read at runtime so Vite does not replace `process.env.FOO` with `undefined` in the server bundle
 * (same pattern as `getServiceRoleKeyFromEnv` in supabase-service-role-env.ts).
 */
function processEnvString(name: string): string {
  const v = Reflect.get(process.env, name);
  return typeof v === "string" ? v : "";
}

/** `process.env` first, then `.env` on disk (TanStack server handlers often miss Vite-injected env). */
function resolveResendEnv(name: string): string {
  const fromProcess = trimResendEnv(processEnvString(name));
  if (fromProcess) return fromProcess;
  return trimResendEnv(readKeyFromEnvFiles(name));
}

/** From-address env keys, first non-empty wins. `VITE_*` last: From is not secret; helps misconfigured setups. */
const RESEND_FROM_ENV_KEYS = [
  "RESEND_FROM_EMAIL",
  "RESEND_MAIL_FROM",
  "EMAIL_FROM",
  "VITE_RESEND_FROM_EMAIL",
] as const;

export function trimResendEnv(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "");
}

/** Trim + strip invisible chars (copy/paste from chat apps). */
export function normalizeBillRecipientEmail(raw: string): string {
  return raw.trim().replace(/[\u200b-\u200d\ufeff]/g, "");
}

/** Extract bare email from a Resend-style From header, e.g. `Groobey <bills@x.com>`. */
export function extractEmailFromFromHeader(from: string): string {
  const trimmed = from.trim();
  const angle = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const token = trimmed.split(/\s+/).find((s) => s.includes("@"));
  return (token ?? trimmed).replace(/^["']|["']$/g, "");
}

function normalizeResendFromRaw(raw: string): string {
  const trimmed = trimResendEnv(raw);
  if (trimmed.includes("<") && trimmed.includes(">")) return trimmed;
  // `Groobey app@domain.com` (space, no brackets) → `Groobey <app@domain.com>`
  const spaced = trimmed.match(/^(.+?)\s+([^\s<>]+@[^\s<>]+)$/);
  if (spaced) return `${spaced[1].trim()} <${spaced[2].trim()}>`;
  // `Groobey app.groobey.in` (missing @) → `Groobey <app@groobey.in>`
  const nameThenHost = trimmed.match(
    /^(.+?)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)\.([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})$/,
  );
  if (nameThenHost) {
    return `${nameThenHost[1].trim()} <${nameThenHost[2]}@${nameThenHost[3]}>`;
  }
  // bare `app.groobey.in` (no @, no display name)
  if (/^[^\s@<>]+\.[^\s@<>]+$/u.test(trimmed) && !trimmed.includes("@")) {
    const dot = trimmed.indexOf(".");
    const local = trimmed.slice(0, dot);
    const domain = trimmed.slice(dot + 1);
    if (local && domain.includes(".")) return `Groobey <${local}@${domain}>`;
  }
  if (trimmed.includes("@")) return `Groobey <${trimmed}>`;
  return trimmed;
}

/** Resend requires `email@x.com` or `Name <email@x.com>`. */
export function isValidResendFromHeader(from: string): boolean {
  const addr = extractEmailFromFromHeader(from);
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(addr);
}

export function getResendFromEmail(): string {
  let raw = "";
  for (const key of RESEND_FROM_ENV_KEYS) {
    raw = resolveResendEnv(key);
    if (raw) break;
  }
  if (!raw) return "Groobey <onboarding@resend.dev>";
  return normalizeResendFromRaw(raw);
}

/** Bare From address domain (for errors / UI), e.g. `tldgroobey.in`. */
export function getResendFromDomain(): string {
  const addr = extractEmailFromFromHeader(getResendFromEmail()).toLowerCase();
  const at = addr.lastIndexOf("@");
  return at > 0 ? addr.slice(at + 1) : "";
}

/** True when any supported From env var is set on the server. */
export function isResendFromEnvExplicitlySet(): boolean {
  return RESEND_FROM_ENV_KEYS.some((key) => Boolean(resolveResendEnv(key)));
}

export function getResendRedirectTo(): string {
  return resolveResendEnv("RESEND_REDIRECT_TO");
}

/** Resend API key - runtime read only (never `VITE_RESEND_API_KEY`; do not expose keys to the client). */
export function getResendApiKeyFromEnv(): string {
  return resolveResendEnv("RESEND_API_KEY");
}

/** Hint when Resend rejects the From domain (includes what the server actually used). */
export function resendDomainFailureHint(resendMessage: string): string {
  const fromDomain = getResendFromDomain();
  const masked = maskEmailForUi(extractEmailFromFromHeader(getResendFromEmail()));
  const msg = resendMessage.toLowerCase();
  let hint = ` Server used From: ${masked}.`;
  if (fromDomain && msg.includes("groobey.in") && !fromDomain.includes("tldgroobey")) {
    hint +=
      ` Your verified Resend domain is tldgroobey.in - use RESEND_FROM_EMAIL=Groobey <you@tldgroobey.in> in .env (not @groobey.in), then restart npm run dev.`;
  } else if (fromDomain && msg.includes("domain is not verified")) {
    hint += ` Confirm ${fromDomain} shows Verified at https://resend.com/domains and matches RESEND_FROM_EMAIL in .env.`;
  }
  return hint;
}

export function resendUsesSandboxFrom(from = getResendFromEmail()): boolean {
  const addr = extractEmailFromFromHeader(from).toLowerCase();
  if (!addr) return true;
  if (addr.endsWith("@resend.dev")) return true;
  if (addr === "onboarding@resend.dev" || addr.startsWith("onboarding@resend.")) return true;
  return false;
}

/** True when FROM is on a verified custom domain (not Resend sandbox). */
export function resendCanEmailExternalRecipients(): boolean {
  return !resendUsesSandboxFrom();
}

/**
 * Short explanation for thrown errors when customer bills are blocked (no API keys).
 * Host-agnostic so deploy instructions stay correct on Vercel, Netlify, etc.
 */
export function resendSandboxSenderExplanation(): string {
  const localVsHost =
    " Local: put them in `.env` next to `package.json` and restart `npm run dev` (Vite loads `.env` at dev server start). " +
    "Hosted: set the same names in your provider's environment UI and redeploy. " +
    "Optional non-secret fallback: `VITE_RESEND_FROM_EMAIL` (bare or `Name <email>`) if you already use Vite-prefixed env for the From address only - never put the API key in a `VITE_` variable.";

  if (!isResendFromEnvExplicitlySet()) {
    return (
      "None of RESEND_FROM_EMAIL, RESEND_MAIL_FROM, EMAIL_FROM, or VITE_RESEND_FROM_EMAIL are visible to this server's process at runtime. " +
      "Customer bills need a verified-domain From even on localhost - `RESEND_API_KEY` alone is not enough (Resend only allows arbitrary recipients once From is off @resend.dev)." +
      localVsHost
    );
  }
  const addr = extractEmailFromFromHeader(getResendFromEmail()).trim() || "(empty)";
  return (
    `Those variables resolve to "${addr}", which is still treated as Resend sandbox (e.g. @resend.dev). ` +
    "Use the From address Resend shows for a domain you verified at https://resend.com/domains - not onboarding@resend.dev." +
    localVsHost
  );
}

export function isResendTestingOrDomainLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("only send testing emails") ||
    m.includes("verify a domain") ||
    m.includes("domain is not verified") ||
    m.includes("not authorized to send") ||
    m.includes("invalid from") ||
    m.includes("from address") ||
    m.includes("testing emails")
  );
}

/** Resend 403 text often includes the only allowed recipient, e.g. (you@gmail.com). */
export function resendTestingAllowlistedTo(message: string): string | null {
  const match = message.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
  return match?.[1]?.trim() ?? null;
}

export function billEmailDevRedirectBannerHtml(intendedTo: string): string {
  const safe = intendedTo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p style="margin:0 0 16px;padding:12px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fdba74;font-size:14px;color:#7c2d12;">
    <strong>Dev / test delivery:</strong> This bill was generated for <strong>${safe}</strong>.
    Resend sandbox cannot deliver to arbitrary addresses until you verify a domain and set <code>RESEND_FROM_EMAIL</code>.
  </p>`;
}

export function billEmailDevRedirectBannerText(intendedTo: string): string {
  return (
    `[Dev/test delivery - bill intended for ${intendedTo}. ` +
    `Verify a domain at resend.com/domains and set RESEND_FROM_EMAIL for production.]\n\n`
  );
}

/** Safe one-line hint for UI (not a secret). */
export function maskEmailForUi(email: string): string {
  const e = extractEmailFromFromHeader(email).trim();
  const at = e.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!local.length) return `***@${domain}`;
  const keep = Math.min(2, local.length);
  return `${local.slice(0, keep)}***@${domain}`;
}

/** What staff see: how bill mail is configured (no API keys). */
export function billEmailDeliveryPublicSnapshot(): {
  apiKeyPresent: boolean;
  canReachCustomerInboxes: boolean;
  fromMode: "verified_domain" | "sandbox";
  fromMasked: string;
  fromAddress: string;
  fromHeader: string;
  fromDomain: string;
  recipientPolicy: string;
  resendFromEnvSet: boolean;
} {
  const fromHeader = getResendFromEmail();
  const addr = extractEmailFromFromHeader(fromHeader);
  return {
    apiKeyPresent: Boolean(getResendApiKeyFromEnv()),
    canReachCustomerInboxes: resendCanEmailExternalRecipients(),
    fromMode: resendUsesSandboxFrom(fromHeader) ? "sandbox" : "verified_domain",
    fromMasked: maskEmailForUi(addr),
    fromAddress: addr,
    fromHeader,
    fromDomain: getResendFromDomain(),
    recipientPolicy:
      "Bill emails go only to the address you enter for the customer. They are not redirected to your admin inbox.",
    resendFromEnvSet: isResendFromEnvExplicitlySet(),
  };
}
