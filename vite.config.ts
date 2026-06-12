// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, componentTagger (dev-only), VITE_* env injection,
//     @ path alias, React/TanStack dedupe, error logger plugins, and sandbox detection.
// Cloudflare is disabled here - production is hosted on Vercel (GitHub integration).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { loadEnv, mergeConfig } from "vite";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolvePublicSupabaseEnv } from "./src/lib/groobey-public-env";

/** Directory containing vite.config.ts (stable even if `process.cwd()` is not the repo root). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Env keys where a non-empty value from `.env` should override the process (local dev clarity). */
const GROOBEY_DOTENV_OVERRIDE_KEYS = new Set([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "PLATFORM_ADMIN_EMAILS",
  "PLATFORM_ADMIN_USER_IDS",
  "RESEND_FROM_EMAIL",
  "RESEND_MAIL_FROM",
  "EMAIL_FROM",
  "VITE_RESEND_FROM_EMAIL",
  "RESEND_API_KEY",
  "RESEND_REDIRECT_TO",
]);

/** Merge `.env` into `process.env` so server code reads secrets at runtime (avoid baking wrong keys via `define`). */
function groobeyDotenvIntoProcessEnvPlugin(): Plugin {
  return {
    name: "groobey-dotenv-into-process-env",
    configResolved(config) {
      const loaded = loadEnv(config.mode, projectRoot, "");
      for (const [k, val] of Object.entries(loaded)) {
        if (val === undefined || val === "") continue;
        if (GROOBEY_DOTENV_OVERRIDE_KEYS.has(k)) {
          process.env[k] = val;
          continue;
        }
        if (process.env[k] === undefined || process.env[k] === "") {
          process.env[k] = val;
        }
      }
    },
  };
}

/** Bake public Supabase config into the client bundle when Vercel/.env provides it at build time. */
function groobeyInjectPublicSupabaseEnvPlugin(): Plugin {
  return {
    name: "groobey-inject-public-supabase-env",
    config(_config, { mode }) {
      const loaded = loadEnv(mode, projectRoot, "");
      const record: Record<string, string | undefined> = { ...process.env, ...loaded };
      const { url, publishableKey } = resolvePublicSupabaseEnv(record);
      const projectId =
        record.VITE_SUPABASE_PROJECT_ID?.trim() || record.SUPABASE_PROJECT_ID?.trim();
      if (!url && !publishableKey && !projectId) return {};
      const define: Record<string, string> = {};
      if (url) define["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(url);
      if (publishableKey) {
        define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(publishableKey);
      }
      if (projectId) define["import.meta.env.VITE_SUPABASE_PROJECT_ID"] = JSON.stringify(projectId);
      return { define };
    },
  };
}

function supabaseEnvPresencePlugin(): Plugin {
  let warned = false;
  return {
    name: "groobey-supabase-env-check",
    apply: "serve",
    configResolved(config) {
      if (warned) return;
      warned = true;
      const loaded = loadEnv(config.mode, projectRoot, "");
      const key = loaded.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!key) {
        console.warn(
          "\n[groobey] SUPABASE_SERVICE_ROLE_KEY is missing or empty. " +
            `Edit ${path.join(projectRoot, ".env")} with the secret service_role key from Supabase → Project Settings → API (not the sb_publishable_ key), then restart vite.\n`,
        );
        return;
      }
      if (/^sb_publishable_/i.test(key)) {
        console.warn(
          "\n[groobey] SUPABASE_SERVICE_ROLE_KEY looks like the publishable (anon) key (sb_publishable_…). " +
            "Platform admin bootstrap and user_roles writes need the secret service_role key (sb_secret_… or legacy service_role JWT). Update .env and restart vite.\n",
        );
      }
    },
  };
}

export default defineConfig({
  cloudflare: false,
  vite: mergeConfig(
    {
      cacheDir: path.join(process.env.LOCALAPPDATA || projectRoot, "groobey-vite-cache"),
      define: {} as Record<string, string>,
      plugins: [
        nitro({ preset: "vercel" }),
        groobeyDotenvIntoProcessEnvPlugin(),
        groobeyInjectPublicSupabaseEnvPlugin(),
        supabaseEnvPresencePlugin(),
        VitePWA({
          registerType: "autoUpdate",
          injectRegister: false,
          includeAssets: [
            "favicon.ico",
            "favicon-16x16.png",
            "favicon-32x32.png",
            "favicon-48x48.png",
            "apple-touch-icon.png",
            "tld-groobey-web-logo.png",
            "groobey-logo-bill.png",
          ],
          manifest: {
            name: "TLD Groobey Merchant Hub",
            short_name: "Groobey",
            description:
              "Shop operations for grocery retail - pricing, sales, orders, attendance, and bills.",
            theme_color: "#9ACD32",
            background_color: "#0a0a0a",
            display: "standalone",
            orientation: "portrait-primary",
            scope: "/",
            start_url: "/",
            id: "/",
            categories: ["business", "productivity", "shopping"],
            icons: [
              {
                src: "pwa-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
              },
              {
                src: "pwa-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
              },
              {
                src: "pwa-512x512-maskable.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
              },
            ],
          },
          // SW is generated post-build (TanStack Start uses ssr:true on client - see scripts/generate-sw.mjs)
          selfDestroying: false,
          devOptions: {
            enabled: false,
            type: "module",
          },
        }),
      ],
    },
    {},
  ),
});
