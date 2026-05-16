import { cn } from "@/lib/utils";
import { GROOBEY_LOGO_DISPLAY, GROOBEY_LOGO_PATH } from "@/lib/groobey-brand";

const sizeClass = {
  sm: "h-10",
  md: "h-12",
  lg: "h-16",
  xl: "h-20",
} as const;

const sizePx = {
  sm: GROOBEY_LOGO_DISPLAY.uiSm,
  md: GROOBEY_LOGO_DISPLAY.uiMd,
  lg: GROOBEY_LOGO_DISPLAY.uiLg,
  xl: GROOBEY_LOGO_DISPLAY.uiXl,
} as const;

export function GroobeyBrandLogo({
  className,
  size = "md",
  withPlate = false,
}: {
  className?: string;
  size?: keyof typeof sizeClass;
  /** Light background so the full logo is visible on dark or busy headers. */
  withPlate?: boolean;
}) {
  const img = (
    <img
      src={GROOBEY_LOGO_PATH}
      alt="TLD Groobey"
      width={Math.round(sizePx[size] * 2.8)}
      height={sizePx[size]}
      className={cn("w-auto shrink-0 object-contain", sizeClass[size], !withPlate && className)}
      decoding="async"
    />
  );

  if (!withPlate) return img;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-white p-2 shadow-sm",
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
    <div className="groobey-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <GroobeyBrandLogo size="xl" withPlate />
      <p className="text-sm font-semibold text-muted-foreground">{message}</p>
    </div>
  );
}

/** Logo + title block for auth cards (login, recovery). */
export function GroobeyAuthBrand({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
      <GroobeyBrandLogo size="lg" withPlate className="mx-auto sm:mx-0" />
      <div className="min-w-0 sm:border-l-2 sm:border-primary/30 sm:pl-4">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">TLD Groobey</p>
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
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-primary/25 bg-card/92 px-4 py-3 shadow-soft backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <GroobeyBrandLogo size="md" withPlate className="hidden sm:inline-flex" />
          <GroobeyBrandLogo size="sm" withPlate className="sm:hidden" />
          <div className="min-w-0 border-l-2 border-primary/30 pl-3 sm:pl-4">
            <h1 className="truncate text-lg font-black tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ?
              <p className="truncate text-xs font-semibold text-muted-foreground">{subtitle}</p>
            : null}
          </div>
        </div>
        {actions ?
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        : null}
      </div>
    </header>
  );
}
