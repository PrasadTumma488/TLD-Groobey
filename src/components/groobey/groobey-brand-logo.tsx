import { cn } from "@/lib/utils";
import { GROOBEY_LOGO_DISPLAY, GROOBEY_WEB_LOGO_PATH } from "@/lib/groobey-brand";

const sizeClass = {
  xs: "h-9",
  sm: "h-12",
  md: "h-16",
  lg: "h-[5.25rem]",
  xl: "h-28",
} as const;

const sizePx = {
  xs: GROOBEY_LOGO_DISPLAY.uiXs,
  sm: GROOBEY_LOGO_DISPLAY.uiSm,
  md: GROOBEY_LOGO_DISPLAY.uiMd,
  lg: GROOBEY_LOGO_DISPLAY.uiLg,
  xl: GROOBEY_LOGO_DISPLAY.uiXl,
} as const;

export function GroobeyBrandLogo({
  className,
  size = "md",
  withPlate = false,
  compactPlate = false,
}: {
  className?: string;
  size?: keyof typeof sizeClass;
  /** Subtle frame so the black logo field reads on light cards. */
  withPlate?: boolean;
  /** Tighter black plate for dashboard headers. */
  compactPlate?: boolean;
}) {
  const img = (
    <img
      src={GROOBEY_WEB_LOGO_PATH}
      alt="TLD Groobey"
      width={sizePx[size]}
      height={sizePx[size]}
      className={cn(
        "groobey-brand-logo-img w-auto max-w-[min(100%,16rem)] shrink-0 object-contain",
        !className && sizeClass[size],
      )}
      decoding="async"
      loading={size === "xl" || size === "lg" ? "eager" : "lazy"}
      fetchPriority={size === "xl" || size === "lg" ? "high" : "auto"}
    />
  );

  if (!withPlate) {
    if (className) {
      return <span className={cn("inline-flex shrink-0 items-center", className)}>{img}</span>;
    }
    return <span className={cn("inline-flex shrink-0 items-center", sizeClass[size])}>{img}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-[#0a0a0a]",
        compactPlate ?
          "rounded-lg border border-primary/35 p-1 shadow-[0_4px_14px_-8px_rgba(154,205,50,0.45)]"
        : "rounded-xl border border-primary/40 p-2 shadow-[0_8px_24px_-8px_rgba(154,205,50,0.45)]",
        className,
      )}
    >
      {img}
    </span>
  );
}

/** Full-screen branded loader for route guards. */
export function GroobeyLoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="groobey-shell groobey-page flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <GroobeyBrandLogo size="xl" withPlate />
      <p className="text-sm font-semibold text-muted-foreground">{message}</p>
    </div>
  );
}

/** Logo + title block for auth cards (login, recovery). */
export function GroobeyAuthBrand({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-4 text-center">
      <GroobeyBrandLogo size="lg" withPlate className="mx-auto" />
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-foreground sm:text-3xl">{title}</h1>
        {subtitle ?
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p>
        : null}
      </div>
    </div>
  );
}

export function GroobeyDashboardHeader({
  title,
  subtitle,
  actions,
  compact = true,
  showLogo = false,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Tighter title and action row for workspace dashboards. */
  compact?: boolean;
  /** Dashboard headers use text only — no TLD logo image. */
  showLogo?: boolean;
}) {
  const logoSize = compact ? "xs" : "md";
  const mobileLogoSize = compact ? "xs" : "sm";

  return (
    <header
      className={cn(
        "groobey-header-safe sticky top-0 z-20 border-b border-border/60 bg-transparent",
        compact ? "groobey-dashboard-header--compact px-3 pb-2 pt-1" : "border-b-2 border-primary/25 px-4 pb-3",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl gap-2",
          compact ?
            "flex-row items-center justify-between"
          : "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          {showLogo ?
            <>
              <GroobeyBrandLogo
                size={logoSize}
                withPlate
                compactPlate={compact}
                className="hidden shrink-0 sm:inline-flex"
              />
              <GroobeyBrandLogo
                size={mobileLogoSize}
                withPlate
                compactPlate={compact}
                className="shrink-0 sm:hidden"
              />
            </>
          : null}
          <div
            className={cn(
              "min-w-0",
              showLogo && "border-l border-primary/25 pl-2 sm:pl-2.5",
            )}
          >
            <h1
              className={cn(
                "truncate font-black tracking-tight text-foreground",
                compact ? "text-sm leading-tight sm:text-base" : "text-base sm:text-2xl",
              )}
            >
              {title}
            </h1>
            {subtitle ?
              <p
                className={cn(
                  "truncate font-semibold text-muted-foreground",
                  compact ? "text-[10px] leading-snug sm:text-[11px]" : "text-[11px] sm:text-xs",
                )}
              >
                {subtitle}
              </p>
            : null}
          </div>
        </div>
        {actions ?
          <div className="groobey-dashboard-header-actions flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
            {actions}
          </div>
        : null}
      </div>
    </header>
  );
}
