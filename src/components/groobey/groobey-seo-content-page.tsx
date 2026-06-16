import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { GroobeyPublicLayout } from "@/components/groobey/groobey-public-layout";

/** Semantic article layout for crawler-friendly static pages (About, Privacy, Terms). */
export function GroobeySeoContentPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <GroobeyPublicLayout className="groobey-seo-page pb-10">
      <article className="groobey-seo-article">
        <header className="groobey-seo-article-header">
          <p className="groobey-seo-article-kicker">
            <Link to="/" className="groobey-seo-article-kicker-link">
              TLD Groobey
            </Link>
          </p>
          <h1 className="groobey-seo-article-title">{title}</h1>
          {lead ?
            <p className="groobey-seo-article-lead">{lead}</p>
          : null}
        </header>
        <div className="groobey-seo-article-body">{children}</div>
      </article>
    </GroobeyPublicLayout>
  );
}

export function GroobeySeoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="groobey-seo-section">
      <h2 className="groobey-seo-section-title">{title}</h2>
      {children}
    </section>
  );
}
