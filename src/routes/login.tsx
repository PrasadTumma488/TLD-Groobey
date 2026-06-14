import { createFileRoute } from "@tanstack/react-router";

import { CustomerLoginFooter, GroobeyLoginCard } from "@/components/groobey/groobey-login-card";
import { GroobeyPublicLayout } from "@/components/groobey/groobey-public-layout";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import { groobeyPageHead } from "@/lib/groobey-seo";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  head: () =>
    groobeyPageHead({
      title: "Sign In",
      description: "Sign in to your TLD Groobey account to shop groceries and track orders.",
      path: "/login",
    }),
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();

  return (
    <GroobeyPublicLayout onSignOut={() => void groobeySignOut()}>
      <main className="mx-auto flex max-w-md flex-col py-8 pb-12">
        <GroobeyLoginCard
          title="Sign in"
          subtitle={
            SHOW_CUSTOMER_PORTAL ?
              "Use the account you created at Register. Delivery and admin staff sign in here too."
            : "Sign in with your account"
          }
          redirectTo={redirect}
          footer={SHOW_CUSTOMER_PORTAL ? <CustomerLoginFooter redirectTo={redirect} /> : null}
        />
      </main>
    </GroobeyPublicLayout>
  );
}
