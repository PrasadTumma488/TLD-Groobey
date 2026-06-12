import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  consumeSectionScrollHandled,
  normalizeSectionHash,
  scrollToSectionAfterNav,
} from "@/lib/groobey-section-scroll";

/** Scroll to in-page sections when the URL hash changes after navigation. */
export function GroobeyHashScroll() {
  const { pathname, hash } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }),
  });

  useEffect(() => {
    const id = normalizeSectionHash(hash);
    if (!id) return;
    if (consumeSectionScrollHandled(id)) return;
    scrollToSectionAfterNav(id);
  }, [pathname, hash]);

  return null;
}
