/** Zepto-style fly animation from product control to cart target. */
export function flyProductToCart(fromEl: HTMLElement, toEl: HTMLElement) {
  if (typeof window === "undefined") return;

  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) return;

  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  const particle = document.createElement("span");
  particle.className = "groobey-shop-fly-particle";
  particle.setAttribute("aria-hidden", "true");
  particle.style.left = `${startX}px`;
  particle.style.top = `${startY}px`;
  document.body.appendChild(particle);

  const dx = endX - startX;
  const dy = endY - startY;

  requestAnimationFrame(() => {
    particle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.35)`;
    particle.style.opacity = "0";
  });

  const cleanup = () => {
    particle.remove();
    toEl.classList.remove("groobey-shop-cart-fly-target--hit");
  };

  particle.addEventListener("transitionend", cleanup, { once: true });
  window.setTimeout(cleanup, 520);

  toEl.classList.add("groobey-shop-cart-fly-target--hit");
}
