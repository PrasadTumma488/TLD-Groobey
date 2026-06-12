import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  markSectionScrollHandled,
  normalizeSectionHash,
  scrollToSection,
  scrollToSectionAfterNav,
} from "@/lib/groobey-section-scroll";

type GroobeySectionLinkProps = {
  to: string;
  hash?: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

/**
 * In-app link: homepage sections always smooth-scroll (up or down).
 */
export function GroobeySectionLink({ to, hash, className, children, onClick }: GroobeySectionLinkProps) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sectionId = normalizeSectionHash(hash);
  const samePath = pathname === to;
  const isHome = to === "/";

  return (
    <Link
      to={to}
      {...(sectionId ? { hash: sectionId } : {})}
      className={className}
      onClick={(e) => {
        onClick?.();

        if (!isHome) return;

        e.preventDefault();

        if (sectionId) {
          markSectionScrollHandled(sectionId);

          if (samePath) {
            scrollToSection(sectionId);
            void router.navigate({ to, hash: sectionId, resetScroll: false, replace: true });
            return;
          }

          void router
            .navigate({ to, hash: sectionId, resetScroll: false })
            .then(() => scrollToSectionAfterNav(sectionId));
          return;
        }

        markSectionScrollHandled("");

        if (samePath) {
          void router.navigate({ to, resetScroll: false, replace: true });
          scrollToSection(undefined);
          return;
        }

        void router.navigate({ to, resetScroll: false });
      }}
    >
      {children}
    </Link>
  );
}
