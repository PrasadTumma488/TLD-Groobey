import { createFileRoute } from "@tanstack/react-router";

import { GroobeySeoContentPage, GroobeySeoSection } from "@/components/groobey/groobey-seo-content-page";
import { GROOBEY_SITE_CONTACT } from "@/lib/groobey-site-contact";
import { groobeyPageHead } from "@/lib/groobey-seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    groobeyPageHead({
      title: "Terms of Service",
      description:
        "Terms of service for ordering groceries online with TLD Groobey — orders, pricing, delivery, and customer accounts.",
      path: "/terms",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <GroobeySeoContentPage
      title="Terms of Service"
      lead="By using the TLD Groobey website and placing orders, you agree to the terms below."
    >
      <GroobeySeoSection title="Orders & pricing">
        <p>
          Product prices, pack sizes, and availability may change without notice. The total on
          your order confirmation and bill reflects the rates at the time your order is placed.
        </p>
      </GroobeySeoSection>
      <GroobeySeoSection title="Delivery">
        <p>
          Delivery times depend on location, order volume, and product availability. Please
          ensure your contact number and address are accurate so our team can reach you.
        </p>
      </GroobeySeoSection>
      <GroobeySeoSection title="Accounts">
        <p>
          You are responsible for keeping your login credentials secure. Account information
          should be accurate and kept up to date for successful delivery.
        </p>
      </GroobeySeoSection>
      <GroobeySeoSection title="Contact">
        <p>
          Questions about these terms? Email{" "}
          <a href={`mailto:${GROOBEY_SITE_CONTACT.email}`}>{GROOBEY_SITE_CONTACT.email}</a> or
          call {GROOBEY_SITE_CONTACT.phone}.
        </p>
      </GroobeySeoSection>
    </GroobeySeoContentPage>
  );
}
