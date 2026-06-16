import { createFileRoute } from "@tanstack/react-router";

import { GroobeySeoContentPage, GroobeySeoSection } from "@/components/groobey/groobey-seo-content-page";
import { GROOBEY_SITE_CONTACT } from "@/lib/groobey-site-contact";
import { groobeyPageHead } from "@/lib/groobey-seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    groobeyPageHead({
      title: "Privacy Policy",
      description:
        "Privacy policy for TLD Groobey online grocery orders — how we use your account, contact, and delivery information.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <GroobeySeoContentPage
      title="Privacy Policy"
      lead="This policy explains how TLD Groobey handles information when you browse our website, create an account, or place a grocery order."
    >
      <GroobeySeoSection title="Information we collect">
        <p>
          When you register or checkout, we collect details needed to fulfil orders — such as
          your name, email, mobile number, and delivery address. Order history and cart activity
          are stored to improve your shopping experience and support billing.
        </p>
      </GroobeySeoSection>
      <GroobeySeoSection title="How we use your information">
        <p>
          We use your information to process orders, send order confirmations and bills,
          coordinate delivery, and respond to support requests. We do not sell your personal
          data to third parties.
        </p>
      </GroobeySeoSection>
      <GroobeySeoSection title="Contact">
        <p>
          For privacy-related questions, email{" "}
          <a href={`mailto:${GROOBEY_SITE_CONTACT.email}`}>{GROOBEY_SITE_CONTACT.email}</a>.
        </p>
      </GroobeySeoSection>
    </GroobeySeoContentPage>
  );
}
