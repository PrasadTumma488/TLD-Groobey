import {
  ArrowUpRight,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

import { GroobeySectionLink } from "@/components/groobey/groobey-section-link";
import {
  GROOBEY_SITE_CONTACT,
  groobeyWhatsAppOrderUrl,
} from "@/lib/groobey-site-contact";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

type ContactCard = {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  action: string;
  href?: string;
  to?: string;
  external?: boolean;
};

function orderOptions(): ContactCard[] {
  const options: ContactCard[] = [];

  if (SHOW_CUSTOMER_PORTAL) {
    options.push({
      id: "shop",
      icon: ShoppingBag,
      title: "Order from the shop",
      text: "Browse our store online, add items to your cart, and place your order directly on the website.",
      to: "/shop",
      action: "Shop online",
    });
  }

  options.push(
  {
    id: "email",
    icon: Mail,
    title: "Order by email",
    text: "Send your grocery list straight to our inbox and we will confirm your order.",
    href: `mailto:${GROOBEY_SITE_CONTACT.email}`,
    action: GROOBEY_SITE_CONTACT.email,
  },
  {
    id: "phone",
    icon: Phone,
    title: "Call and order",
    text: "Speak with us directly, share what you need, and place your order over the phone.",
    href: `tel:${GROOBEY_SITE_CONTACT.phone.replace(/\s/g, "")}`,
    action: GROOBEY_SITE_CONTACT.phone,
  },
  {
    id: "whatsapp-order",
    icon: MessageCircle,
    title: "Order on WhatsApp",
    text: "Message your list on WhatsApp for quick replies, delivery updates, and reviews.",
    href: groobeyWhatsAppOrderUrl(),
    action: "Chat on WhatsApp",
    external: true,
  },
  );

  return options;
}

const COMMUNITY_OPTIONS: ContactCard[] = [
  {
    id: "whatsapp-group",
    icon: Users,
    title: "Join our WhatsApp group",
    text: "Get offers, store updates, and connect with other TLD Groobey shoppers.",
    href: GROOBEY_SITE_CONTACT.whatsappGroupUrl,
    action: GROOBEY_SITE_CONTACT.whatsappGroupLabel,
    external: true,
  },
  {
    id: "instagram",
    icon: Instagram,
    title: "Follow on Instagram",
    text: "See fresh picks, deals, and behind-the-scenes updates on our social feed.",
    href: GROOBEY_SITE_CONTACT.instagramUrl,
    action: GROOBEY_SITE_CONTACT.instagramHandle,
    external: true,
  },
];

export function GroobeyHomeContact() {
  return (
    <section id="contact" className="groobey-home-contact groobey-nav-scroll-mt" aria-labelledby="contact-heading">
      <div className="groobey-home-contact-header">
        <h2 id="contact-heading" className="groobey-home-contact-title">
          Order your way - we are easy to reach
        </h2>
        <p className="groobey-home-contact-lead">
          Shop on our website, or reach us by email, phone, or WhatsApp. Join our group and Instagram
          to stay in the loop on offers and updates.
        </p>
      </div>

      <div className="groobey-home-contact-block">
        <ul className="groobey-home-contact-grid groobey-home-contact-grid--order">
          {orderOptions().map((item) => (
            <ContactCardItem key={item.id} item={item} />
          ))}
        </ul>
      </div>

      <div className="groobey-home-contact-block">
        <ul className="groobey-home-contact-grid groobey-home-contact-grid--community">
          {COMMUNITY_OPTIONS.map((item) => (
            <ContactCardItem key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ContactCardItem({ item }: { item: ContactCard }) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="groobey-home-contact-card-icon-wrap" aria-hidden>
        <Icon className="groobey-home-contact-card-icon" strokeWidth={1.75} />
      </span>
      <span className="groobey-home-contact-card-body">
        <span className="groobey-home-contact-card-title">{item.title}</span>
        <span className="groobey-home-contact-card-text">{item.text}</span>
        <span className="groobey-home-contact-card-action">
          <span>{item.action}</span>
          <ArrowUpRight className="groobey-home-contact-card-arrow" strokeWidth={2} aria-hidden />
        </span>
      </span>
    </>
  );

  return (
    <li className="groobey-home-contact-card">
      {item.to ?
        <GroobeySectionLink to={item.to} className="groobey-home-contact-card-link">
          {body}
        </GroobeySectionLink>
      : <a
          href={item.href}
          className="groobey-home-contact-card-link"
          {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {body}
        </a>
      }
    </li>
  );
}
