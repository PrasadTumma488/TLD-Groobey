import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/team/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    portal: typeof search.portal === "string" ? search.portal : undefined,
  }),
  component: TeamLoginRedirect,
});

/** Legacy URL - unified sign-in lives at /login. */
function TeamLoginRedirect() {
  const { portal } = Route.useSearch();
  return <Navigate to="/login" search={portal ? { portal } : {}} replace />;
}
