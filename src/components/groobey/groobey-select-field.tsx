import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type GroobeySelectOption = {
  value: string;
  label: string;
};

/**
 * Radix dropdown - same look as the rest of Groobey (white card, chevron, no native OS picker).
 */
export function GroobeySelect({
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  disabled,
  className,
  size = "default",
  fullWidth = true,
  contentClassName,
  "aria-labelledby": ariaLabelledBy,
  id,
}: {
  value: string;
  onValueChange: (next: string) => void;
  options: GroobeySelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm";
  /** false = fit content (tables, toolbars); true = stretch parent (forms). */
  fullWidth?: boolean;
  contentClassName?: string;
  "aria-labelledby"?: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "groobey-select-trigger border-2 bg-card text-left shadow-sm",
          fullWidth ? "w-full" : "w-auto min-w-[8.5rem] max-w-full",
          size === "sm" ?
            "h-9 min-h-9 rounded-xl px-3 text-xs"
          : "h-11 min-h-11 rounded-2xl px-3 text-sm",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        className={cn(
          "groobey-select-content z-[100] max-h-[min(16rem,50dvh)] rounded-2xl border-2 border-border bg-card p-1 shadow-[var(--shadow-soft)]",
          contentClassName,
        )}
      >
        {options.map((opt) => (
          <SelectItem
            key={opt.value || "__empty__"}
            value={opt.value}
            className="rounded-xl py-2.5 text-sm font-semibold"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
