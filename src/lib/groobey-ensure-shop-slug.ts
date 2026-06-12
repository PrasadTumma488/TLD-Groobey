import { createServerFn } from "@tanstack/react-start";

import { requesterTokenSchema } from "@/lib/tldGroobey.functions-schemas";

type HandlerCtx = { data: unknown };

async function invokeHandler(name: string, ctx: HandlerCtx) {
  const mod = await import("./tldGroobey.handlers.server");
  const fn = mod[name as keyof typeof mod];
  if (typeof fn !== "function") throw new Error(`Missing server handler: ${name}`);
  return (fn as (c: HandlerCtx) => Promise<unknown>)(ctx);
}

/** Ensure the signed-in member has a `/my/:slug` URL. */
export const ensureMyShopSlug = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("ensureMyShopSlugHandler", ctx));
