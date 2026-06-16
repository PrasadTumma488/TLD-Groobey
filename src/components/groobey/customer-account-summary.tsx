import {
  Calendar,
  Hash,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";

import type { TldUserAccountSummary } from "@/lib/groobey-tld-user-account";
import { TLD_USER_ID_LABEL } from "@/lib/groobey-tld-user-account";

export function CustomerAccountSummary({
  summary,
  compact = false,
}: {
  summary: TldUserAccountSummary;
  /** Hide duplicate contact block when parent shows edit form. */
  compact?: boolean;
}) {
  return (
    <section className="groobey-customer-account-summary" aria-label="Your TLD account">
      <div className="groobey-customer-account-summary-hero">
        <span className="groobey-admin-inbox-avatar size-12 text-lg" aria-hidden>
          {(summary.displayName[0] || "U").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black leading-tight">{summary.displayName}</p>
          <p className="mt-0.5 text-xs font-bold text-primary">{summary.userNumberLabel}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            TLD Groobey shopper
            {!summary.isActive ? " · Account paused" : ""}
          </p>
        </div>
      </div>

      <div className="groobey-customer-account-summary-id">
        <p className="groobey-customer-account-summary-id-label">
          <Hash className="size-3.5" aria-hidden />
          {TLD_USER_ID_LABEL}
        </p>
        <p className="groobey-customer-account-summary-id-value">{summary.tldUserId}</p>
        <p className="groobey-customer-account-summary-id-hint">
          {summary.hasPermanentGroobeyId ?
            "Your permanent member code — date + daily signup number (same format as bill IDs)."
          : "Assigning your TLD User ID…"}
        </p>
      </div>

      <div className="groobey-customer-account-summary-stats">
        <div className="groobey-customer-account-summary-stat groobey-customer-account-summary-stat--primary">
          <ShoppingBag className="size-4 shrink-0 opacity-80" aria-hidden />
          <div>
            <p className="groobey-customer-account-summary-stat-value">{summary.monthlyOrders}</p>
            <p className="groobey-customer-account-summary-stat-label">
              Monthly orders · {summary.monthLabel}
            </p>
          </div>
        </div>
        <div className="groobey-customer-account-summary-stat">
          <Calendar className="size-4 shrink-0 opacity-70" aria-hidden />
          <div>
            <p className="groobey-customer-account-summary-stat-value text-sm font-black leading-snug">
              {summary.lastOrderThisMonthLabel}
            </p>
            <p className="groobey-customer-account-summary-stat-label">Last order this month</p>
          </div>
        </div>
      </div>

      <p className="groobey-customer-account-summary-note">
        Monthly orders reset at the start of each new month.
      </p>

      {!compact ?
        <dl className="groobey-customer-account-summary-details">
          <div>
            <dt className="groobey-customer-account-summary-dt">
              <UserRound className="size-3.5" aria-hidden /> Member since
            </dt>
            <dd>{summary.joinedLabel}</dd>
          </div>
          {summary.email ?
            <div>
              <dt className="groobey-customer-account-summary-dt">
                <Mail className="size-3.5" aria-hidden /> Email
              </dt>
              <dd>{summary.email}</dd>
            </div>
          : null}
          {summary.phone ?
            <div>
              <dt className="groobey-customer-account-summary-dt">
                <Phone className="size-3.5" aria-hidden /> Mobile
              </dt>
              <dd>{summary.phone}</dd>
            </div>
          : null}
          {summary.defaultAddress ?
            <div className="sm:col-span-2">
              <dt className="groobey-customer-account-summary-dt">
                <MapPin className="size-3.5" aria-hidden /> Delivery address
              </dt>
              <dd>{summary.defaultAddress}</dd>
            </div>
          : null}
        </dl>
      : null}
    </section>
  );
}
