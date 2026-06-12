import { useEffect, useState, type ReactNode } from "react";

import { ensurePublicSupabaseEnv, supabase } from "@/integrations/supabase/client";
import {
  resolveSessionAccessFromSession,
  type SessionAccess,
} from "@/lib/groobey-public-access";

const EMPTY_ACCESS: SessionAccess = {
  audience: "anonymous",
  email: null,
  displayName: null,
  shopSlug: null,
  shopPath: null,
  roles: [],
  primaryDashboard: null,
  dashboards: [],
  canAccessShop: false,
};

/** Resolves nav links without blocking the homepage - content renders immediately. */
export function GroobeyPublicAccessGate({
  children,
}: {
  children: (ctx: SessionAccess) => ReactNode;
}) {
  const [access, setAccess] = useState<SessionAccess>(EMPTY_ACCESS);

  useEffect(() => {
    let cancelled = false;
    void ensurePublicSupabaseEnv().then(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setAccess(await resolveSessionAccessFromSession(supabase, data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      void resolveSessionAccessFromSession(supabase, session).then((resolved) => {
        if (!cancelled) setAccess(resolved);
      });
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <>{children(access)}</>;
}

export type { SessionAccess };
