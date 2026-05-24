import { Loader2, Mail } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const SETTLEMENT_BILL_EMAIL_HINT = "Pre-filled from shop owner Groobey profile";

export const BILL_RECIPIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBillRecipientEmailValid(email: string): boolean {
  return BILL_RECIPIENT_EMAIL_RE.test(email.trim());
}

export function GroobeyBillEmailSendField({
  label,
  hint,
  inputId,
  email,
  onEmailChange,
  onSend,
  sending = false,
  sendLabel = "Send",
  sendAriaLabel,
  placeholder = "name@example.com",
  variant = "default",
  layout = "panel",
  inputDisabled = false,
  feedback,
  footer,
  className,
  inputClassName,
}: {
  label: string;
  hint?: string;
  inputId: string;
  email: string;
  onEmailChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  sendLabel?: string;
  sendAriaLabel?: string;
  placeholder?: string;
  variant?: "default" | "settlement";
  /** panel = boxed card; bar = compact single row for modal footer */
  layout?: "panel" | "bar";
  inputDisabled?: boolean;
  feedback?: { notice?: string; error?: string };
  footer?: ReactNode;
  className?: string;
  inputClassName?: string;
}) {
  const ready = isBillRecipientEmailValid(email);
  const resolvedHint =
    hint ?? (variant === "settlement" ? SETTLEMENT_BILL_EMAIL_HINT : undefined);

  if (layout === "bar") {
    return (
      <div
        className={cn(
          "groobey-bill-email-send-bar space-y-2",
          variant === "settlement" && "groobey-bill-email-send-bar--settlement",
          className,
        )}
        role="region"
        aria-label={label}
      >
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <label
            id={`${inputId}-label`}
            htmlFor={inputId}
            className="shrink-0 text-sm font-bold text-foreground sm:w-[7.5rem]"
          >
            {label}
          </label>
          <div className="flex min-w-0 flex-1 items-stretch gap-2">
            <Input
              id={inputId}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={placeholder}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={cn("h-11 min-w-0 flex-1 text-sm", inputClassName)}
              disabled={inputDisabled || sending}
              aria-labelledby={`${inputId}-label`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready && !sending) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button
              type="button"
              variant="groobey"
              className="h-11 shrink-0 rounded-xl px-4 text-sm font-bold"
              disabled={sending || !ready}
              aria-label={sendAriaLabel ?? sendLabel}
              onClick={() => onSend()}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <>
                  <Mail className="size-4 sm:mr-1" aria-hidden />
                  <span>{sendLabel}</span>
                </>
              )}
            </Button>
          </div>
        </div>
        {resolvedHint ? (
          <p className="text-[11px] font-semibold text-muted-foreground sm:pl-[7.75rem]">{resolvedHint}</p>
        ) : null}
        {footer}
        {feedback?.notice || feedback?.error ? (
          <p
            className={cn(
              "text-xs font-medium leading-snug sm:pl-[7.75rem]",
              feedback.error ? "text-destructive" : "text-emerald-700",
            )}
            role="status"
            aria-live="polite"
          >
            {feedback.error ?? feedback.notice}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "groobey-bill-email-send-field space-y-2",
        variant === "settlement"
          ? "rounded-xl border border-amber-200/80 bg-amber-50/50 p-3"
          : "rounded-xl border border-border/80 bg-muted/20 p-3",
        className,
      )}
      role="region"
      aria-label={label}
    >
      <div>
        <label id={`${inputId}-label`} htmlFor={inputId} className="text-sm font-bold text-foreground">
          {label}
        </label>
        {resolvedHint ? (
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-muted-foreground">{resolvedHint}</p>
        ) : null}
      </div>

      <div className="flex min-w-0 items-stretch gap-2">
        <Input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={cn("h-11 min-w-0 flex-1 text-sm", inputClassName)}
          disabled={inputDisabled || sending}
          aria-labelledby={`${inputId}-label`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready && !sending) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          type="button"
          variant="groobey"
          className="h-11 shrink-0 rounded-xl px-3 text-sm font-bold sm:min-w-[5.5rem] sm:px-4"
          disabled={sending || !ready}
          aria-label={sendAriaLabel ?? sendLabel}
          onClick={() => onSend()}
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <>
              <Mail className="size-4 sm:mr-1" aria-hidden />
              <span>{sendLabel}</span>
            </>
          )}
        </Button>
      </div>

      {footer}
      {feedback?.notice || feedback?.error ? (
        <p
          className={cn(
            "text-xs font-medium leading-snug",
            feedback.error ? "text-destructive" : "text-emerald-700",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback.error ?? feedback.notice}
        </p>
      ) : null}
    </div>
  );
}
