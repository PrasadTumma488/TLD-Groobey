import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GroobeySheetDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "groobey-sheet-overlay fixed inset-0 z-[60]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
GroobeySheetDialogOverlay.displayName = "GroobeySheetDialogOverlay";

export const GroobeySheetDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <GroobeySheetDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}

      className={cn("groobey-sheet-dialog", className)}
      onOpenAutoFocus={(e) => e.preventDefault()}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
GroobeySheetDialogContent.displayName = "GroobeySheetDialogContent";

export function GroobeySheetDialogBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("groobey-sheet-dialog-body groobey-scrollbar", className)}>
      {children}
    </div>
  );
}

export function GroobeySheetDialogHeader({
  title,
  description,
  onClose,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("groobey-sheet-dialog-header", className)}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-left">
          <DialogTitle className="text-base font-black leading-snug tracking-tight text-foreground sm:text-lg">
            {title}
          </DialogTitle>
          {description != null && description !== "" ?
            <DialogDescription className="text-xs font-semibold leading-snug text-muted-foreground sm:text-sm">
              {description}
            </DialogDescription>
          : null}
        </div>
        {actions ?
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-xl border-2 border-border bg-card shadow-sm"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Sticky footer on mobile so closing is always reachable. */
export function GroobeySheetDialogFooter({
  onClose,
  closeLabel = "Done",
  className,
}: {
  onClose: () => void;
  closeLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("groobey-sheet-dialog-footer", className)}>
      <Button
        type="button"
        variant="groobey"
        className="min-h-11 w-full rounded-xl text-sm font-bold"
        onClick={onClose}
      >
        {closeLabel}
      </Button>
    </div>
  );
}
