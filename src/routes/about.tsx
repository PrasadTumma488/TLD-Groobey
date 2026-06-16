import { Link, createFileRoute } from "@tanstack/react-router";

import {
  GroobeySeoContentPage,
  GroobeySeoSection,
} from "@/components/groobey/groobey-seo-content-page";
import { HOME_CATEGORIES } from "@/lib/groobey-home-categories";
import { GROOBEY_SITE_CONTACT } from "@/lib/groobey-site-contact";
import {
  groobeyAboutJsonLd,
  groobeyPageHead,
  groobeyWebPageHeadScripts,
} from "@/lib/groobey-seo";
import { SHOP_COMBOS_TILE } from "@/lib/groobey-shop-browse";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

export const Route = createFileRoute("/about")({
  head: () => ({
    ...groobeyPageHead({
      title: "About TLD Groobey - Online Grocery Store",
      description:
        "Learn about TLD Groobey — your trusted online grocery store for rice, dal, fresh produce, pickles, meat, combos, and doorstep delivery across India.",
      path: "/about",
    }),
    scripts: groobeyWebPageHeadScripts(groobeyAboutJsonLd()),
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <GroobeySeoContentPage
      title="About TLD Groobey"
      lead="TLD Groobey is an online grocery store built for families who want fresh staples, seasonal produce, and value combo packs — ordered in minutes and delivered to the door."
    >
      <GroobeySeoSection title="What we offer">
        <p>
          TLD Groobey brings everyday shopping online. Browse a wide catalog of groceries —
          rice, pulses, oil, sugar, and household essentials — alongside farm-fresh vegetables
          and fruits, traditional pickles, papads, chicken, mutton, and curated combo packs that
          help you save on weekly shopping.
        </p>
        <p>
          Our website is designed for simple ordering: search products, choose pack sizes, add
          items to your cart, and checkout with clear bills and delivery details saved for next
          time.
        </p>
      </GroobeySeoSection>

      <GroobeySeoSection title="Shop by category">
        <p>
          Explore our main categories online. Each section links directly to the shop so you can
          start ordering right away.
        </p>
        <ul className="groobey-seo-link-list">
          {HOME_CATEGORIES.map((category) => (
            <li key={category.id}>
              {SHOW_CUSTOMER_PORTAL ?
                <Link to="/shop" search={{ category: category.id }}>
                  {category.label}
                </Link>
              : <span>{category.label}</span>}
              {" — "}
              {category.subtitle}
            </li>
          ))}
          <li>
            {SHOW_CUSTOMER_PORTAL ?
              <Link to="/shop" search={{ category: "combos" }}>
                {SHOP_COMBOS_TILE.label}
              </Link>
            : <span>{SHOP_COMBOS_TILE.label}</span>}
            {" — "}
            {SHOP_COMBOS_TILE.subtitle}
          </li>
        </ul>
      </GroobeySeoSection>

      <GroobeySeoSection title="How ordering works">
        <ol className="groobey-seo-ordered-list">
          <li>Browse categories or search for products on the shop page.</li>
          <li>Add items to your cart and review quantities and pack sizes.</li>
          <li>Sign in or create an account, confirm delivery details, and place your order.</li>
          <li>We pack fresh and deliver to your doorstep with a clear bill.</li>
        </ol>
        {SHOW_CUSTOMER_PORTAL ?
          <p>
            <Link to="/shop" className="groobey-seo-inline-cta">
              Start shopping online
            </Link>
          </p>
        : null}
      </GroobeySeoSection>

      <GroobeySeoSection title="Contact & support">
        <p>
          Questions about an order, delivery, or product availability? Reach TLD Groobey by
          email at{" "}
          <a href={`mailto:${GROOBEY_SITE_CONTACT.email}`}>{GROOBEY_SITE_CONTACT.email}</a>, phone
          at <a href={`tel:${GROOBEY_SITE_CONTACT.phone.replace(/\s/g, "")}`}>{GROOBEY_SITE_CONTACT.phone}</a>
          , or visit our{" "}
          <Link to="/" hash="contact">
            contact section on the home page
          </Link>
          .
        </p>
      </GroobeySeoSection>
    </GroobeySeoContentPage>
  );
}
