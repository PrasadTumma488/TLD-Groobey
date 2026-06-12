import { AlertTriangle, ExternalLink, KeyRound } from "lucide-react";

const SUPABASE_API_SETTINGS_URL =
  "https://supabase.com/dashboard/project/idhgenxhczbgddihdlid/settings/api";

export function GroobeyServiceRoleSetupPanel() {
  return (
    <section
      className="rounded-2xl border-2 border-amber-400/80 bg-amber-50/90 p-4 shadow-sm sm:p-5"
      role="alert"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-950">
          <KeyRound className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-black text-amber-950">Server setup required</p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-amber-950/90">
              Admin actions (staff list, customer registration, delivery updates) need{" "}
              <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs font-bold">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              in your project root <code className="text-xs">.env</code>. Catalog and order views may
              still load, but server features will fail until this is set.
            </p>
          </div>

          <ol className="list-decimal space-y-1.5 pl-5 text-sm font-semibold text-amber-950/90">
            <li>
              Open{" "}
              <a
                href={SUPABASE_API_SETTINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-black text-amber-950 underline underline-offset-2"
              >
                Supabase → Project Settings → API
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
            </li>
            <li>
              Copy the secret <strong>service_role</strong> key (not the publishable / anon key).
            </li>
            <li>
              In the project root, run:{" "}
              <code className="block mt-1 rounded-lg bg-amber-100/70 px-2 py-1.5 text-xs font-mono font-bold">
                npm run env:service-role -- YOUR_KEY_HERE
              </code>
            </li>
            <li>Restart the dev server: npm run dev</li>
          </ol>

          <p className="flex items-start gap-2 text-xs font-semibold text-amber-900/80">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            For Cloudflare dev, put the same key in <code>dist/server/.dev.vars</code> if your build
            copies <code>.env</code> there.
          </p>
        </div>
      </div>
    </section>
  );
}
