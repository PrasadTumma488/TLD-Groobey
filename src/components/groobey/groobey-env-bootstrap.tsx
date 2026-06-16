import { useEffect } from "react";

import { ensurePublicSupabaseEnv, hasPublicSupabaseConfig } from "@/integrations/supabase/client";

/** Hydrate public Supabase config in the background — never block first paint. */
export function GroobeyEnvBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!hasPublicSupabaseConfig()) {
      void ensurePublicSupabaseEnv();
    }
  }, []);

  return <>{children}</>;
}
