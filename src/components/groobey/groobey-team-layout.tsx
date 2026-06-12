import { Link } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { GroobeyBrandLogo } from "@/components/groobey/groobey-brand-logo";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import { cn } from "@/lib/utils";

/** Minimal shell for delivery / admin team sign-in (not the customer storefront). */
export function GroobeyTeamLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const year = new Date().getFullYear();
  return (
    <div className="groobey-team-shell flex min-h-dvh flex-col bg-[#0a0a0a] text-zinc-100">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4 sm:h-16">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-primary" aria-hidden />
            <span className="text-sm font-black tracking-wide">{GROOBEY_APP_NAME} Team</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Customer site
          </Link>
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6", className)}>
        <div className="mb-6 flex justify-center">
          <GroobeyBrandLogo size="md" withPlate />
        </div>
        {children}
      </main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-[10px] font-medium text-zinc-500">
        Team access only. Accounts are created by platform admin.
        <span className="mt-2 block">© {year} TLD Groobey</span>
      </footer>
    </div>
  );
}
