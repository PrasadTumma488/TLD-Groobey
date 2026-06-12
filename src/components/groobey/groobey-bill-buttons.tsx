import { AlertTriangle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BillKind } from "@/lib/groobey-dual-bill";
import { cn } from "@/lib/utils";

export type BillButtonsLayout = "wrap" | "equal" | "stack" | "compact" | "grid";

export function BillKindButtons({
  onPrint,
  compact = false,
  layout,
  className,
  customerOnly = false,
}: {
  onPrint: (kind: BillKind) => void;
  compact?: boolean;
  layout?: BillButtonsLayout;
  className?: string;
  /** When true, only the customer bill button is shown (no settlement copy). */
  customerOnly?: boolean;
}) {
  const resolvedLayout: BillButtonsLayout = layout ?? (compact ? "equal" : "wrap");

  const btnClass = cn(
    "inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-lg px-2 text-center font-bold leading-tight",
    resolvedLayout === "compact" ? "h-8 min-h-8 text-[10px]"
    : resolvedLayout === "wrap" || resolvedLayout === "grid" ?
      "min-h-10 h-10 rounded-xl text-sm"
    : "min-h-9 h-9 text-[10px] sm:text-[11px]",
  );

  const settlementLabel = compact ? "Settlement" : "Settlement (internal)";

  if (customerOnly) {
    return (
      <div
        role="group"
        aria-label="Print customer bill"
        className={cn("groobey-bill-kind-buttons min-w-0", className)}
      >
        <Button
          type="button"
          variant="groobey"
          className={cn(btnClass, "border-2 border-emerald-700/30")}
          onClick={() => onPrint("customer")}
          aria-label="Print customer bill"
        >
          <Users className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">Customer bill</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Print bills"
      className={cn(
        "groobey-bill-kind-buttons min-w-0",
        resolvedLayout === "equal" && "grid w-full grid-cols-2 gap-2",
        resolvedLayout === "grid" && "grid w-full grid-cols-2 gap-2",
        resolvedLayout === "stack" && "grid w-full grid-cols-1 gap-1.5",
        resolvedLayout === "compact" && "grid w-[10.25rem] max-w-full grid-cols-1 gap-1",
        resolvedLayout === "wrap" && "flex flex-wrap gap-2",
        className,
      )}
    >
      <Button
        type="button"
        variant="groobey"
        className={cn(btnClass, "border-2 border-emerald-700/30")}
        onClick={() => onPrint("customer")}
        aria-label="Print customer bill"
      >
        <Users className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">Customer bill</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          btnClass,
          "border-2 border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100",
        )}
        onClick={() => onPrint("merchant")}
        aria-label={`Print ${settlementLabel}`}
      >
        <AlertTriangle className="size-3.5 shrink-0 text-amber-700" aria-hidden />
        <span className="truncate">{settlementLabel}</span>
      </Button>
    </div>
  );
}
