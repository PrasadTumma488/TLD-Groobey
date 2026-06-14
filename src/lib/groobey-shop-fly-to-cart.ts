function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Size the fly dot from the product row and viewport so it reads on every screen. */
function flyParticleSize(from: DOMRect): number {
  const vw = window.innerWidth;
  const fromItem = Math.min(from.width, from.height) * 0.34;
  const fromScreen = vw * 0.055;
  return Math.round(clamp(Math.max(fromItem, fromScreen), 24, 48));
}

/** Zepto-style fly animation from product row to cart target. */
export function flyProductToCart(fromEl: HTMLElement, toEl: HTMLElement) {
  if (typeof window === "undefined") return;

  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) return;

  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  const dx = endX - startX;
  const dy = endY - startY;
  const size = flyParticleSize(from);
  const durationMs = 940;
  const endScale = 0.4;

  const particle = document.createElement("span");
  particle.className = "groobey-shop-fly-particle";
  particle.setAttribute("aria-hidden", "true");
  particle.style.left = `${startX}px`;
  particle.style.top = `${startY}px`;
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  document.body.appendChild(particle);

  const arcLift = clamp(Math.abs(dx) * 0.1 + Math.abs(dy) * 0.06, 28, 88);
  const midDx = dx * 0.48;
  const midDy = dy * 0.42 - arcLift;

  const cleanup = () => {
    particle.remove();
    toEl.classList.remove("groobey-shop-cart-fly-target--hit");
  };

  toEl.classList.add("groobey-shop-cart-fly-target--hit");

  const anim = particle.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      {
        transform: `translate(calc(-50% + ${midDx}px), calc(-50% + ${midDy}px)) scale(0.78)`,
        opacity: 0.82,
        offset: 0.5,
      },
      {
        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${endScale})`,
        opacity: 0.12,
      },
    ],
    {
      duration: durationMs,
      easing: "cubic-bezier(0.25, 0.55, 0.35, 1)",
      fill: "forwards",
    },
  );

  anim.onfinish = cleanup;
  window.setTimeout(cleanup, durationMs + 160);
}
