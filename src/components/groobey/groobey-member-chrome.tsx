import type { ReactNode } from "react";

import { GroobeyPublicAccessGate } from "@/components/groobey/groobey-public-access-gate";
import { GroobeyPublicNavbar } from "@/components/groobey/groobey-public-navbar";
import { GroobeySiteFooter } from "@/components/groobey/groobey-site-footer";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import { cn } from "@/lib/utils";

/** Shared navbar + footer shell for signed-in workspaces (shop, delivery, admin). */
export function GroobeyMemberChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <GroobeyPublicAccessGate>
      {(access) => (
        <div className="groobey-public-shell">
          <GroobeyPublicNavbar
            access={access}
            onSignOut={() => void groobeySignOut()}
          />
          <div className={cn("groobey-public-main w-full", className)}>{children}</div>
          <GroobeySiteFooter />
        </div>
      )}
    </GroobeyPublicAccessGate>
  );
}
