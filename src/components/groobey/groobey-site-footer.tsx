import { Instagram, Mail, Phone } from "lucide-react";
import type { ComponentType } from "react";

import { GroobeyBrandLogo } from "@/components/groobey/groobey-brand-logo";
import { GroobeySectionLink } from "@/components/groobey/groobey-section-link";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import {
  footerDesktopQuickLinkGrid,
  footerLegalLinks,
  footerQuickLinks,
} from "@/lib/groobey-public-sitemap";
import { GROOBEY_SITE_CONTACT } from "@/lib/groobey-site-contact";
import { cn } from "@/lib/utils";

type ContactIconProps = { className?: string; strokeWidth?: number };

type ContactItem = {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
  display: string;
  icon: ComponentType<ContactIconProps>;
  external?: boolean;
};

function WhatsAppIcon({ className }: ContactIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const CONTACT_LINKS: ContactItem[] = [
  {
    id: "email",
    href: `mailto:${GROOBEY_SITE_CONTACT.email}`,
    label: "Email",
    shortLabel: "Email",
    display: GROOBEY_SITE_CONTACT.email,
    icon: Mail,
  },
  {
    id: "phone",
    href: `tel:${GROOBEY_SITE_CONTACT.phone.replace(/\s/g, "")}`,
    label: "Phone",
    shortLabel: "Phone",
    display: GROOBEY_SITE_CONTACT.phone,
    icon: Phone,
  },
  {
    id: "whatsapp",
    href: GROOBEY_SITE_CONTACT.whatsappGroupUrl,
    label: "Join WhatsApp group",
    shortLabel: "WhatsApp",
    display: GROOBEY_SITE_CONTACT.whatsappGroupLabel,
    icon: WhatsAppIcon,
    external: true,
  },
  {
    id: "instagram",
    href: GROOBEY_SITE_CONTACT.instagramUrl,
    label: `${GROOBEY_SITE_CONTACT.instagramHandle} on Instagram`,
    shortLabel: "Instagram",
    display: GROOBEY_SITE_CONTACT.instagramHandle,
    icon: Instagram,
    external: true,
  },
];

export function GroobeySiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  const links = footerQuickLinks();
  const desktopGridLinks = footerDesktopQuickLinkGrid();
  const legal = footerLegalLinks();

  return (
    <div className={cn("groobey-site-footer-gap", className)}>
      <footer className="groobey-site-footer" aria-label="Site footer">
        <div className="groobey-site-footer-inner">
          <div className="groobey-site-footer-mobile">
            <FooterBrand layout="row" logoSize="md" />

            <nav className="groobey-site-footer-mobile-nav" aria-label="Footer links">
              {links.map((link) => (
                <FooterNavLink key={`m-${link.href}-${link.hash ?? ""}-${link.label}`} link={link} />
              ))}
            </nav>

            <div
              className="groobey-site-footer-inline-bar groobey-site-footer-inline-bar--contact"
              aria-label="Get in touch"
            >
              <div className="groobey-site-footer-contact-icons">
                {CONTACT_LINKS.map((item) => (
                  <ContactIconButton key={`m-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          </div>

          <div className="groobey-site-footer-desktop">
            <div className="groobey-site-footer-desktop-main">
              <FooterBrand layout="column" logoSize="lg" className="groobey-site-footer-brand--desktop" />

              <div className="groobey-site-footer-desktop-nav-col">
                <nav className="groobey-site-footer-desktop-nav" aria-label="Quick links">
                  {desktopGridLinks.map((link, index) =>
                    link ?
                      <FooterNavLink
                        key={`grid-${index}-${link.href}-${link.hash ?? ""}-${link.label}`}
                        link={link}
                      />
                    : <span key={`grid-empty-${index}`} className="groobey-site-footer-nav-slot" aria-hidden />,
                  )}
                </nav>
              </div>

              <div className="groobey-site-footer-desktop-contact-col">
                <div className="groobey-site-footer-contact-list" aria-label="Get in touch">
                  {CONTACT_LINKS.map((item) => (
                    <ContactLink key={`d-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <FooterBar year={year} legal={legal} />
        </div>
      </footer>
    </div>
  );
}

function FooterBrand({
  layout,
  logoSize,
  className,
}: {
  layout: "row" | "column";
  logoSize: "md" | "lg";
  className?: string;
}) {
  return (
    <GroobeySectionLink
      to="/"
      className={cn(
        "groobey-site-footer-brand",
        layout === "column" && "groobey-site-footer-brand--column",
        className,
      )}
    >
      <GroobeyBrandLogo size={logoSize} className="groobey-site-footer-logo" />
      <span className="groobey-site-footer-brand-text">
        <span className="groobey-site-footer-name">{GROOBEY_APP_NAME}</span>
        <span className="groobey-site-footer-tagline">You Order. We Deliver. Fresh and Fast.</span>
      </span>
    </GroobeySectionLink>
  );
}

function FooterBar({
  year,
  legal,
}: {
  year: number;
  legal: ReturnType<typeof footerLegalLinks>;
}) {
  return (
    <div className="groobey-site-footer-bar groobey-site-footer-inline-bar groobey-site-footer-corporate">
      <p className="groobey-site-footer-copy">© {year} TLD Groobey. All rights reserved.</p>
      <nav className="groobey-site-footer-legal groobey-site-footer-inline-links" aria-label="Legal">
        {legal.map((item, i) => (
          <span key={item.label} className="groobey-site-footer-inline-item">
            {i > 0 ?
              <span className="groobey-site-footer-inline-sep" aria-hidden>
                ·
              </span>
            : null}
            {item.external ?
              <a href={item.href} className="groobey-site-footer-inline-link">
                {item.label}
              </a>
            : <GroobeySectionLink
                to={item.href}
                hash={item.hash}
                className="groobey-site-footer-inline-link"
              >
                {item.label}
              </GroobeySectionLink>
            }
          </span>
        ))}
      </nav>
    </div>
  );
}

function ContactIconButton({ item }: { item: ContactItem }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      className="groobey-site-footer-contact-icon-btn"
      aria-label={item.label}
      title={item.label}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <Icon className="groobey-site-footer-contact-icon shrink-0" strokeWidth={1.75} />
    </a>
  );
}

function ContactLink({ item }: { item: ContactItem }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      className="groobey-site-footer-contact-link"
      aria-label={item.label}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <Icon className="groobey-site-footer-contact-icon shrink-0" strokeWidth={1.75} aria-hidden />
      <span>{item.display}</span>
    </a>
  );
}

function FooterNavLink({
  link,
}: {
  link: { label: string; href: string; hash?: string };
}) {
  return (
    <GroobeySectionLink
      to={link.href}
      hash={link.hash}
      className="groobey-site-footer-nav-link"
    >
      {link.label}
    </GroobeySectionLink>
  );
}
