import { useMemo } from "react";

import { parseGroceryOrderItemsText } from "@/lib/groobey-grocery-order-items";
import { cn } from "@/lib/utils";

export function GroceryOrderItemsList({
  text,
  className,
  showHeading = true,
}: {
  text?: string | null;
  className?: string;
  showHeading?: boolean;
}) {
  const items = useMemo(() => parseGroceryOrderItemsText(text), [text]);
  if (!items.length) return null;

  return (
    <div className={cn("min-w-0", className)}>
      {showHeading ?
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Items
        </p>
      : null}
      <ul
        className={cn("space-y-1.5", showHeading && "mt-1.5")}
        role="list"
        aria-label="Order items"
      >
        {items.map((item, index) => (
          <li
            key={`${index}-${item.raw ?? item.name}`}
            className="rounded-lg border border-border/80 bg-muted/25 px-2.5 py-2 text-xs"
          >
            {item.raw ?
              <p className="break-words font-semibold text-foreground">{item.raw}</p>
            : <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <div className="min-w-0">
                  <p className="font-bold text-foreground">{item.name}</p>
                  <p className="font-semibold text-muted-foreground">
                    {item.unit} × {item.quantity}
                    <span className="font-medium"> @ ₹{item.unitPrice}</span>
                  </p>
                </div>
                <p className="shrink-0 font-black tabular-nums text-foreground">
                  ₹{Math.round(item.lineTotal)}
                </p>
              </div>
            }
          </li>
        ))}
      </ul>
    </div>
  );
}
