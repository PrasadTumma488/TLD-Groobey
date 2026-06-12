/** Strip leading `#` from router or anchor hashes. */
export function normalizeSectionHash(hash: string | undefined): string {
  return (hash ?? "").replace(/^#+/, "");
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function navScrollOffset(): number {
  const root = getComputedStyle(document.documentElement);
  const navOffset = Number.parseFloat(root.getPropertyValue("--groobey-nav-offset"));
  return (Number.isFinite(navOffset) ? navOffset : 0) + 12;
}

let lastHandledHashScroll: { id: string; at: number } | null = null;

/** Skip duplicate hash-scroll when GroobeySectionLink already scrolled. */
export function markSectionScrollHandled(hash: string | undefined) {
  lastHandledHashScroll = { id: normalizeSectionHash(hash), at: Date.now() };
}

export function consumeSectionScrollHandled(hash: string | undefined): boolean {
  const id = normalizeSectionHash(hash);
  if (!lastHandledHashScroll || lastHandledHashScroll.id !== id) return false;
  if (Date.now() - lastHandledHashScroll.at > 600) return false;
  lastHandledHashScroll = null;
  return true;
}

export function scrollToSection(hash: string | undefined, behavior?: ScrollBehavior) {
  const motion = behavior ?? scrollBehavior();
  const id = normalizeSectionHash(hash);

  if (!id) {
    window.scrollTo({ top: 0, behavior: motion });
    return true;
  }

  const el = document.getElementById(id);
  if (!el) return false;

  const top = el.getBoundingClientRect().top + window.scrollY - navScrollOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: motion });
  return true;
}

/** Retry briefly so cross-page hash links scroll after the target section mounts. */
export function scrollToSectionAfterNav(hash: string | undefined) {
  const id = normalizeSectionHash(hash);
  if (!id) return;

  const attempt = (tries: number) => {
    if (scrollToSection(id)) return;
    if (tries < 24) requestAnimationFrame(() => attempt(tries + 1));
  };

  requestAnimationFrame(() => attempt(0));
}
