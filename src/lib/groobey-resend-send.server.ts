import { Resend } from "resend";

import {
  billEmailDevRedirectBannerHtml,
  billEmailDevRedirectBannerText,
  getResendApiKeyFromEnv,
  getResendFromEmail,
  getResendRedirectTo,
  isResendTestingOrDomainLimitError,
  resendCanEmailExternalRecipients,
  resendDomainFailureHint,
  resendTestingAllowlistedTo,
} from "@/lib/groobey-resend";

export type ResendSendResult = {
  deliveredTo: string;
  requestedTo: string;
  /** True when sandbox redirected to test inbox instead of customer. */
  devRedirect?: boolean;
};

type ResendAttachment = {
  filename: string;
  content: Buffer | Uint8Array;
};

function formatResendFailure(message: string, statusCode: number | null, name: string): string {
  const core = `Email send failed (${statusCode ?? "?"}): ${message}`;
  const testing =
    message.includes("only send testing emails") ||
    message.includes("verify a domain") ||
    message.includes("domain is not verified");
  if (testing) {
    return (
      `${core} For real customer inboxes, verify a domain at https://resend.com/domains and set RESEND_FROM_EMAIL. ` +
      "For non-bill mail in dev, RESEND_REDIRECT_TO can redirect to your Resend test inbox; customer bills always use the recipient address first."
    );
  }
  if (name === "invalid_api_key" || message.includes("API key is invalid")) {
    return `${core} Update RESEND_API_KEY from https://resend.com/api-keys`;
  }
  return core;
}

/**
 * Sends via Resend. Always tries the real `to` first.
 * When `allowTestModeRedirectFallback` is true, sandbox/domain errors may retry to Resend's
 * allowlisted test address or `RESEND_REDIRECT_TO`. Customer bills pass `false` so they never
 * silently go to an admin/test inbox.
 */
export async function sendResendEmail(
  params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    attachments?: ResendAttachment[];
    tags?: { name: string; value: string }[];
  },
  options?: {
    allowTestModeRedirectFallback?: boolean;
    /** Prepends dev banner when delivery is redirected away from the requested address. */
    billIntendedRecipient?: boolean;
  },
): Promise<ResendSendResult> {
  const allowFallback = options?.allowTestModeRedirectFallback ?? true;
  const rawKey = getResendApiKeyFromEnv();
  if (!rawKey) {
    throw new Error("Missing RESEND_API_KEY in .env. Add it and restart dev server.");
  }
  const fromEmail = getResendFromEmail();
  const redirectTo = getResendRedirectTo();
  const requestedTo = params.to.trim();
  const toList = [requestedTo];

  const resend = new Resend(rawKey);
  let html = params.html;
  let text = params.text;
  let subject = params.subject;

  const attachments =
    params.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
    })) ?? [];

  const payload = () => ({
    from: fromEmail,
    subject,
    html,
    text,
    replyTo: params.replyTo?.trim() || undefined,
    attachments: attachments.length ? attachments : undefined,
    tags: params.tags,
    headers: {
      "X-Entity-Ref-ID": `groobey-bill-${Date.now()}`,
    },
  });

  let deliveredTo = requestedTo;
  let { error } = await resend.emails.send({ ...payload(), to: toList });

  const tryFallback = async (fallbackTo: string) => {
    if (options?.billIntendedRecipient && fallbackTo.toLowerCase() !== requestedTo.toLowerCase()) {
      html = billEmailDevRedirectBannerHtml(requestedTo) + html;
      text = billEmailDevRedirectBannerText(requestedTo) + text;
      if (!subject.includes(requestedTo)) {
        subject = `[Bill for ${requestedTo}] ${subject}`;
      }
    }
    deliveredTo = fallbackTo;
    return resend.emails.send({ ...payload(), to: [fallbackTo] });
  };

  if (error && allowFallback && isResendTestingOrDomainLimitError(error.message)) {
    const onlyTo = resendTestingAllowlistedTo(error.message);
    if (onlyTo && onlyTo.toLowerCase() !== deliveredTo.toLowerCase()) {
      const retry = await tryFallback(onlyTo);
      error = retry.error;
    }
  }

  if (
    error &&
    allowFallback &&
    redirectTo &&
    redirectTo.toLowerCase() !== deliveredTo.toLowerCase()
  ) {
    const retry = await tryFallback(redirectTo);
    error = retry.error;
  }

  if (error) {
    if (isResendTestingOrDomainLimitError(error.message)) {
      const billOnlyHint =
        options?.billIntendedRecipient && !options?.allowTestModeRedirectFallback ?
          " Customer bills cannot be redirected to a test inbox. Verify your domain at https://resend.com/domains and set RESEND_FROM_EMAIL (e.g. Groobey <bills@yourdomain.com>), then restart the server."
        : "";
      const hint =
        billOnlyHint ||
        (resendCanEmailExternalRecipients() ?
          ""
        : " Set RESEND_FROM_EMAIL to an address on a domain verified at https://resend.com/domains. " +
          "Until then, set RESEND_REDIRECT_TO to your Resend account email for dev/test delivery.");
      throw new Error(
        `Could not send email to ${requestedTo}. ${error.message}${resendDomainFailureHint(error.message)}${hint}`,
      );
    }
    throw new Error(formatResendFailure(error.message, error.statusCode, error.name));
  }

  const devRedirect = deliveredTo.toLowerCase() !== requestedTo.toLowerCase();
  return { deliveredTo, requestedTo, devRedirect: devRedirect || undefined };
}
