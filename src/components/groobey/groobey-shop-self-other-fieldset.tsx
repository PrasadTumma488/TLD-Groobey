import { Button } from "@/components/ui/button";
import type { DeliveryDestinationKind } from "@/lib/groobey-delivery-order-fields";
import { cn } from "@/lib/utils";

const OPTIONS: ReadonlyArray<{ value: DeliveryDestinationKind; label: string }> = [
  { value: "shop", label: "Shop" },
  { value: "self", label: "Self" },
  { value: "other", label: "Other" },
];

/** Shop / Self / Other - order type or work location (not courier “delivery destination”). */
export function GroobeyShopSelfOtherFieldset({
  value,
  onChange,
  disabled,
  legend,
  hint,
  radiogroupLabel,
  className,
  idPrefix = "channel",
}: {
  value: DeliveryDestinationKind;
  onChange: (next: DeliveryDestinationKind) => void;
  disabled?: boolean;
  legend: string;
  hint?: string;
  radiogroupLabel: string;
  className?: string;
  idPrefix?: string;
}) {
  const hintId = `${idPrefix}-hint`;

  return (
    <fieldset className={cn("grid gap-2 border-0 p-0", className)}>
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      {hint ?
        <p id={hintId} className="text-xs font-semibold text-muted-foreground">
          {hint}
        </p>
      : null}
      <div
        role="radiogroup"
        aria-label={radiogroupLabel}
        aria-describedby={hint ? hintId : undefined}
        className="grid grid-cols-3 gap-2"
      >
        {OPTIONS.map(({ value: optionValue, label }) => {
          const active = value === optionValue;
          return (
            <Button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={active}
              variant={active ? "groobey" : "outline"}
              className="h-11 rounded-xl text-sm"
              disabled={disabled}
              onClick={() => onChange(optionValue)}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
