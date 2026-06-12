import { createServerFn } from "@tanstack/react-start";

import { requesterTokenSchema } from "@/lib/tldGroobey.functions-schemas";

type HandlerCtx = { data: unknown };

async function invokeHandler(name: string, ctx: HandlerCtx) {
  const mod = await import("./tldGroobey.handlers.server");
  const fn = mod[name as keyof typeof mod];
  if (typeof fn !== "function") throw new Error(`Missing server handler: ${name}`);
  return (fn as (c: HandlerCtx) => Promise<unknown>)(ctx);
}

/** Ensures allowlisted admin / delivery emails have roles in user_roles after login. */
export const bootstrapAllowlistedRoles = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("bootstrapAllowlistedRolesHandler", ctx));
