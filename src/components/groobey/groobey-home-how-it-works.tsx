import { ArrowRight, Search, ShoppingCart, Truck, type LucideIcon } from "lucide-react";

import { GroobeySectionLink } from "@/components/groobey/groobey-section-link";
import { GroobeySlideToOrder } from "@/components/groobey/groobey-slide-to-order";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

type HowItWorksStep = {
  n: string;
  icon: LucideIcon;
  title: string;
  text: string;
};

const STEPS: HowItWorksStep[] = [
  {
    n: "01",
    icon: Search,
    title: "Browse",
    text: "Explore categories and pick the pack sizes that suit your home.",
  },
  {
    n: "02",
    icon: ShoppingCart,
    title: "Order",
    text: "Add items to your cart and checkout in a few simple steps.",
  },
  {
    n: "03",
    icon: Truck,
    title: "Delivered",
    text: "We pack fresh and bring your groceries to your door - fast.",
  },
];

export function GroobeyHomeHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="groobey-home-how groobey-nav-scroll-mt"
      aria-labelledby="how-it-works-heading"
    >
      <div className="groobey-home-how-hero">
        <h2 id="how-it-works-heading" className="groobey-home-how-title">
          How it works
        </h2>
        <p className="groobey-home-how-lead">
          Three easy steps from your screen to your doorstep. Fresh groceries, delivered with care.
        </p>
      </div>

      <div className="groobey-home-how-body">
        <ol className="groobey-home-how-steps">
          {STEPS.map((step) => {
            const Icon = step.icon;

            return (
              <li key={step.n} className="groobey-home-how-step">
                <div className="groobey-home-how-node" aria-hidden>
                  <span className="groobey-home-how-node-glow" />
                  <span className="groobey-home-how-node-ring" />
                  <span className="groobey-home-how-node-inner">
                    <Icon className="groobey-home-how-node-icon" strokeWidth={1.85} />
                  </span>
                  <span className="groobey-home-how-node-num">{step.n}</span>
                </div>
                <div className="groobey-home-how-step-card">
                  <h3 className="groobey-home-how-step-title">{step.title}</h3>
                  <p className="groobey-home-how-step-text">{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="groobey-home-how-footer">
          <p className="groobey-home-how-tagline">You order. We deliver. Fresh and fast.</p>
          {SHOW_CUSTOMER_PORTAL ?
            <GroobeySlideToOrder />
          : <GroobeySectionLink to="/" hash="contact" className="groobey-home-how-cta groobey-home-how-cta--outline">
              <span className="groobey-home-how-cta-label">Get in touch</span>
              <span className="groobey-home-how-cta-icon-wrap" aria-hidden>
                <ArrowRight className="groobey-home-how-cta-icon" strokeWidth={2.5} />
              </span>
            </GroobeySectionLink>
          }
        </div>
      </div>
    </section>
  );
}
