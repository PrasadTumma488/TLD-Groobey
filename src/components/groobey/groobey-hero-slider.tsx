import { ChevronLeft, ChevronRight, Package, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  GROOBEY_SLIDER_IMAGE_SIZES,
  groobeySliderImageSrcSet,
} from "@/lib/groobey-home-images";
import { GroobeyMarketingImage } from "@/components/groobey/groobey-marketing-image";
import {
  HOME_SLIDER_BG,
  HOME_SLIDER_IMAGE,
  HOME_SLIDER_SLIDES,
} from "@/lib/groobey-home-slider";
import { HOME_SLIDER_INTERVAL_MS } from "@/lib/groobey-site-visibility";
import { cn } from "@/lib/utils";

export function GroobeyHeroSlider() {
  const slides = HOME_SLIDER_SLIDES;
  const [index, setIndex] = useState(0);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(goNext, HOME_SLIDER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [goNext, slides.length]);

  return (
    <div className="groobey-slider-shell">
      <section
        aria-label="Home banners"
        className="overflow-hidden rounded-2xl border border-black/30 shadow-[var(--shadow-soft)]"
        style={{ backgroundColor: HOME_SLIDER_BG }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: `${HOME_SLIDER_IMAGE.width} / ${HOME_SLIDER_IMAGE.height}`,
            backgroundColor: HOME_SLIDER_BG,
          }}
        >
          <div
            className="flex h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.src}
                className="flex h-full w-full shrink-0 items-center justify-center"
                style={{ backgroundColor: HOME_SLIDER_BG }}
              >
                <GroobeyMarketingImage
                  pngSrc={slide.src}
                  webpSrcSet={groobeySliderImageSrcSet(slide.src)}
                  sizes={GROOBEY_SLIDER_IMAGE_SIZES}
                  alt={slide.alt}
                  className="block max-h-full max-w-full object-contain object-center"
                  width={HOME_SLIDER_IMAGE.width}
                  height={HOME_SLIDER_IMAGE.height}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {slides.length > 1 ?
        <div
          className="groobey-slider-nav-pill"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Previous banner"
            className="groobey-slider-nav-pill-btn"
            onClick={goPrev}
          >
            <ChevronLeft className="size-3.5 stroke-[2.5]" aria-hidden />
          </button>

          <div className="groobey-slider-nav-pill-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                aria-label={`Show banner ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "groobey-slider-nav-dot",
                  i === index && "groobey-slider-nav-dot--active",
                )}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next banner"
            className="groobey-slider-nav-pill-btn"
            onClick={goNext}
          >
            <ChevronRight className="size-3.5 stroke-[2.5]" aria-hidden />
          </button>
        </div>
      : null}
    </div>
  );
}

const PROMO_HIGHLIGHTS = [
  {
    icon: Package,
    title: "500+ items",
    text: "Daily grocery catalog",
    tint: "bg-primary/12 text-[#3d6b12]",
  },
  {
    icon: Truck,
    title: "Fast delivery",
    text: "Clear bills and tracking",
    tint: "bg-emerald-100 text-emerald-800",
  },
  {
    icon: ShieldCheck,
    title: "Trusted quality",
    text: "Fresh staples you can rely on",
    tint: "bg-lime-100 text-lime-800",
  },
  {
    icon: ShoppingCart,
    title: "Easy ordering",
    text: "Browse, cart, and checkout",
    tint: "bg-green-100 text-green-800",
  },
] as const;

export function GroobeyPromoStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {PROMO_HIGHLIGHTS.map(({ icon: Icon, title, text, tint }) => (
        <div
          key={title}
          className="flex gap-3 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5",
              tint,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight text-foreground sm:text-base">{title}</p>
            <p className="mt-1 text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
              {text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
