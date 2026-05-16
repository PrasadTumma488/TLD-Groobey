import { AlertTriangle, FileText, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BillKind } from "@/lib/groobey-dual-bill";
import { cn } from "@/lib/utils";

export function BillKindButtons({
  onPrint,
  compact = false,
  showEmail,
  onEmail,
  emailDisabled,
}: {
  onPrint: (kind: BillKind) => void;
  compact?: boolean;
  showEmail?: boolean;
  onEmail?: () => void;
  emailDisabled?: boolean;
}) {
  const btnClass = compact ? "h-8 rounded-lg px-2 text-xs" : "min-h-10 rounded-xl text-sm";

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="groobey"
        className={cn(btnClass, "border-2 border-emerald-700/30")}
        onClick={() => onPrint("customer")}
      >
        <Users className="size-3.5 shrink-0" />
        Customer bill
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          btnClass,
          "border-2 border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100",
        )}
        onClick={() => onPrint("merchant")}
      >
        <AlertTriangle className="size-3.5 shrink-0 text-amber-700" />
        Settlement (internal)
      </Button>
      {showEmail && onEmail ?
        <Button
          type="button"
          variant="outline"
          className={btnClass}
          onClick={() => void onEmail()}
          disabled={emailDisabled}
        >
          <FileText className="size-3.5" /> Email customer bill
        </Button>
      : null}
    </div>
  );
}
