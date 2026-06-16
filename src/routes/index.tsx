import { createFileRoute } from "@tanstack/react-router";
import { Leaf, ShoppingBag, Tags, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { GroobeyCategoryGrid } from "@/components/groobey/groobey-category-grid";
import { GroobeyHomeContact } from "@/components/groobey/groobey-home-contact";
import { GroobeyHomeHowItWorks } from "@/components/groobey/groobey-home-how-it-works";
import { GroobeyHeroSlider, GroobeyPromoStrip } from "@/components/groobey/groobey-hero-slider";
import { GroobeyPublicLayout } from "@/components/groobey/groobey-public-layout";
import { GroobeySlideToOrder } from "@/components/groobey/groobey-slide-to-order";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";
import { groobeyHomeJsonLd, groobeyPageHead, groobeyWebPageHeadScripts } from "@/lib/groobey-seo";
import { GroobeyMarketingImage } from "@/components/groobey/groobey-marketing-image";
import { HOME_SLIDER_SLIDES } from "@/lib/groobey-home-slider";

const GROOBEY_STAFF_IMAGE = "/home/groobey-staff.png";
const GROOBEY_CAPTION_IMAGE = "/home/groobey-caption.png";
const LCP_HERO_IMAGE = HOME_SLIDER_SLIDES[0]?.src ?? "/home-slider/slider-1_grocery.png";

export const Route = createFileRoute("/")({
  head: () => ({
    ...groobeyPageHead({
      title: "TLD Groobey - Fresh Groceries Online",
      description:
        "Shop rice, dal, vegetables, fruits, combos & more. Order online with TLD Groobey for fresh groceries and doorstep delivery.",
      path: "/",
    }),
    links: [
      {
        rel: "preload",
        href: LCP_HERO_IMAGE,
        as: "image",
        type: "image/png",
        fetchPriority: "high",
      },
    ],
    scripts: groobeyWebPageHeadScripts(groobeyHomeJsonLd()),
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <GroobeyPublicLayout className="groobey-home-main space-y-16 pb-8 sm:pb-10">
      <h1 className="sr-only">TLD Groobey — fresh groceries online with doorstep delivery</h1>
      <GroobeyHeroSlider />
      <GroobeyPromoStrip />

      <section id="categories" className="groobey-nav-scroll-mt">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-foreground">Shop by category</h2>
        </div>
        <GroobeyCategoryGrid />
      </section>

      <section className="rounded-[2rem] border border-primary/15 bg-white/75 p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <figure
            className="groobey-home-staff-visual"
            aria-label="You Order. We Deliver. Fresh and Fast."
            onContextMenu={(e) => e.preventDefault()}
          >
            <GroobeyMarketingImage
              pngSrc={GROOBEY_CAPTION_IMAGE}
              alt=""
              className="groobey-home-staff-caption"
              width={498}
              height={141}
              loading="lazy"
              draggable={false}
            />
            <GroobeyMarketingImage
              pngSrc={GROOBEY_STAFF_IMAGE}
              alt="TLD Groobey delivery team"
              className="groobey-home-staff-photo"
              width={407}
              height={612}
              loading="lazy"
              draggable={false}
            />
          </figure>

          <div className="min-w-0">
            <h2 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
              Groceries for your home, delivered with care
            </h2>
            <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
              You order. We deliver. Fresh and fast. Browse daily staples and fresh picks, place
              your order, and our team brings groceries straight to your doorstep.
            </p>
            {SHOW_CUSTOMER_PORTAL ?
              <div className="groobey-home-shoppers-slide mt-6">
                <GroobeySlideToOrder label="Slide to start shopping" />
              </div>
            : null}

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={Leaf}
                title="Fresh daily picks"
                text="Produce, staples, and household essentials you can trust."
              />
              <InfoCard
                icon={Truck}
                title="Doorstep delivery"
                text="Reliable delivery with clear bills and order updates."
              />
              <InfoCard
                icon={ShoppingBag}
                title="Easy online shopping"
                text="Browse categories, compare pack sizes, and fill your cart in minutes."
              />
              <InfoCard
                icon={Tags}
                title="Deals & combos"
                text="Value packs and weekly picks that help you save on everyday shopping."
              />
            </div>
          </div>
        </div>
      </section>

      <GroobeyHomeHowItWorks />

      <GroobeyHomeContact />
    </GroobeyPublicLayout>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-2 font-black">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

