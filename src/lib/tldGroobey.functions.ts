import { createServerFn } from "@tanstack/react-start";

import {
  createAccountSchema,
  deleteStaffSchema,
  requesterTokenSchema,
  resolveShopOwnerEmailsSchema,
  sendCustomerBillSchema,
  sendPasswordResetSchema,
  sendWorkConfirmationSchema,
  setStaffActiveSchema,
  shopDetailsSchema,
  updateMyProfileSchema,
  updateStaffSchema,
  markDeliveryOrderStatusSchema,
  registerCustomerSchema,
} from "@/lib/tldGroobey.functions-schemas";

type HandlerCtx = { data: unknown };

async function invokeHandler<T extends HandlerCtx | void>(name: string, ctx?: T) {
  const mod = await import("./tldGroobey.handlers.server");
  const fn = mod[name as keyof typeof mod];
  if (typeof fn !== "function") throw new Error(`Missing server handler: ${name}`);
  return ctx === undefined ? (fn as () => Promise<unknown>)() : (fn as (c: HandlerCtx) => Promise<unknown>)(ctx);
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => createAccountSchema.parse(input))
  .handler(async (ctx) => invokeHandler("createStaffAccountHandler", ctx));

export const getSetupStatus = createServerFn({ method: "GET" })

  .handler(async () => invokeHandler("getSetupStatusHandler"));

export const syncGroobeyCodes = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("syncGroobeyCodesHandler", ctx));

export const ensureMyGroobeyCode = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("ensureMyGroobeyCodeHandler", ctx));

export const saveShopDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => shopDetailsSchema.parse(input))
  .handler(async (ctx) => invokeHandler("saveShopDetailsHandler", ctx));

export const listStaffAccounts = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("listStaffAccountsHandler", ctx));

export const setStaffAccountActive = createServerFn({ method: "POST" })
  .inputValidator((input) => setStaffActiveSchema.parse(input))
  .handler(async (ctx) => invokeHandler("setStaffAccountActiveHandler", ctx));

export const updateStaffAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => updateStaffSchema.parse(input))
  .handler(async (ctx) => invokeHandler("updateStaffAccountHandler", ctx));

export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => updateMyProfileSchema.parse(input))
  .handler(async (ctx) => invokeHandler("updateMyProfileHandler", ctx));

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => deleteStaffSchema.parse(input))
  .handler(async (ctx) => invokeHandler("deleteStaffAccountHandler", ctx));

export const sendCustomerBillEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => sendCustomerBillSchema.parse(input))
  .handler(async (ctx) => invokeHandler("sendCustomerBillEmailHandler", ctx));

export const resolveShopOwnerEmails = createServerFn({ method: "POST" })
  .inputValidator((input) => resolveShopOwnerEmailsSchema.parse(input))
  .handler(async (ctx) => invokeHandler("resolveShopOwnerEmailsHandler", ctx));

export const getBillEmailDeliveryInfo = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("getBillEmailDeliveryInfoHandler", ctx));

export const sendWorkConfirmationEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => sendWorkConfirmationSchema.parse(input))
  .handler(async (ctx) => invokeHandler("sendWorkConfirmationEmailHandler", ctx));

export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => sendPasswordResetSchema.parse(input))
  .handler(async (ctx) => invokeHandler("sendPasswordResetEmailHandler", ctx));

export const markDeliveryOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => markDeliveryOrderStatusSchema.parse(input))
  .handler(async (ctx) => invokeHandler("markDeliveryOrderStatusHandler", ctx));

export const registerCustomerAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => registerCustomerSchema.parse(input))
  .handler(async (ctx) => invokeHandler("registerCustomerAccountHandler", ctx));

export const getShopCombosSchemaStatus = createServerFn({ method: "GET" }).handler(async () =>
  invokeHandler("getShopCombosSchemaStatusHandler"),
);

export const ensureShopCombosSchema = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("ensureShopCombosSchemaHandler", ctx));

export const getProductsOutOfStockSchemaStatus = createServerFn({ method: "GET" }).handler(async () =>
  invokeHandler("getProductsOutOfStockSchemaStatusHandler"),
);

export const ensureProductsOutOfStockSchema = createServerFn({ method: "POST" })
  .inputValidator((input) => requesterTokenSchema.parse(input))
  .handler(async (ctx) => invokeHandler("ensureProductsOutOfStockSchemaHandler", ctx));
