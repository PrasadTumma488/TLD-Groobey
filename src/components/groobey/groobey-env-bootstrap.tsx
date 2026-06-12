import { useEffect, useState } from "react";

import { GroobeyLoadingScreen } from "@/components/groobey/groobey-brand-logo";
import {
  ensurePublicSupabaseEnv,
  hasPublicSupabaseConfig,
} from "@/integrations/supabase/client";

/** Loads public Supabase config at runtime (not in view-source HTML). */
export function GroobeyEnvBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(
    () => typeof window === "undefined" || hasPublicSupabaseConfig(),
  );

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    void (async () => {
      const ok = await ensurePublicSupabaseEnv();
      if (!cancelled) setReady(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return <GroobeyLoadingScreen message="Connecting securely…" />;
  }

  return <>{children}</>;
}
