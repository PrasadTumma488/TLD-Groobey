import type { LucideIcon } from "lucide-react";

export type StaffIdentityRow = {
  label: string;
  value: string;
};

/** Shared “your details” card for shop owner, order taker, etc. */
export function StaffIdentityCard({
  title,
  icon: Icon,
  subtitle,
  rows,
}: {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  rows: StaffIdentityRow[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-3 text-sm font-semibold leading-relaxed">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="font-black">{title}</span>
      </div>
      {subtitle ?
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{subtitle}</p>
      : null}
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">{row.label}</dt>
            <dd className="break-all font-semibold text-foreground">{row.value || "-"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
