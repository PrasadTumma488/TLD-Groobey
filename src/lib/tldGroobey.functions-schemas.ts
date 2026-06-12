import { z } from "zod";

export const roleSchema = z.enum([
  "main_admin",
  "admin",
  "merchant",
  "employee",
  "order_taker",
  "customer",
]);

export const registerCustomerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(10).max(20),
  defaultAddress: z.string().trim().min(5).max(500),
  password: z.string().min(8).max(72),
});

export const createAccountSchema = z
  .object({
    requesterToken: z.string().optional(),
    displayName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
    password: z.union([z.string().min(8).max(72), z.literal("")]).optional(),
    role: roleSchema,
  })
  .refine((value) => (value.role === "merchant" ? Boolean(value.email && value.phone) : true), {
    message: "Shop Owner login requires both email and mobile number",
    path: ["email"],
  })
  .refine((value) => value.role !== "customer", {
    message: "Customer accounts are created via the public sign-up page.",
    path: ["role"],
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or mobile number is required",
    path: ["email"],
  })
  .refine(
    (value) =>
      value.role === "employee" || value.role === "order_taker"
        ? Boolean(value.email?.trim())
        : true,
    {
      message: "Staff and Order Taker logins need a login email (same one used at sign-in).",
      path: ["email"],
    },
  )
  .refine(
    (value) => {
      if (value.role === "employee") return true;
      const pwd = value.password?.trim() ?? "";
      return pwd.length >= 8;
    },
    { message: "Password is required for this role (min 8 characters).", path: ["password"] },
  );

export const shopDetailsSchema = z.object({
  requesterToken: z.string().min(10),
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

export const requesterTokenSchema = z.object({
  requesterToken: z.string().min(10),
});

export const setStaffActiveSchema = z.object({
  requesterToken: z.string().min(10),
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export const updateStaffSchema = z.object({
  requesterToken: z.string().min(10),
  userId: z.string().uuid(),
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
});

export const updateMyProfileSchema = z.object({
  requesterToken: z.string().min(10),
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
});

export const resolveShopOwnerEmailsSchema = z.object({
  requesterToken: z.string().min(10),
  shopIds: z.array(z.string().uuid()).max(200),
});

export const deleteStaffSchema = z.object({
  requesterToken: z.string().min(10),
  userId: z.string().uuid(),
});

export const markDeliveryOrderStatusSchema = z.object({
  requesterToken: z.string().min(10),
  orderId: z.string().uuid(),
  status: z.enum(["packed", "out_for_delivery", "delivered"]),
});

const sendCustomerBillLineItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive(),
  packUnit: z.string().trim().max(40).optional(),
  unitPrice: z.number().nonnegative(),
  merchantUnitPrice: z.number().nonnegative().optional(),
});

export const customerOrderBillEmailSchema = z.object({
  orderItemsText: z.string().trim().min(1).max(8000),
  totalAmount: z.number().nonnegative(),
  grocerySubtotal: z.number().nonnegative().optional(),
  deliveryCharge: z.number().nonnegative().optional(),
  merchantSettlementAmount: z.number().nonnegative().optional(),
  tradeMarginPercent: z.number().min(0).max(100).optional(),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().max(80).optional(),
  deliveryAddress: z.string().trim().max(500).optional(),
  deliveryDestination: z.string().trim().max(20).optional(),
  customerStreetAddress: z.string().trim().max(500).optional(),
  deliveryTimeSlot: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  shopName: z.string().trim().max(120).optional(),
});

export const sendCustomerBillSchema = z
  .object({
    requesterToken: z.string().min(10),
    /** When set, the authenticated customer must own this order (self-service confirmation email). */
    orderId: z.string().uuid().optional(),
    customerEmail: z
      .string()
      .trim()
      .max(255)
      .refine((s) => s === "" || z.string().email().safeParse(s).success, {
        message: "Invalid customer email",
      }),
    subject: z.string().trim().min(3).max(160),
    shopName: z.string().trim().min(2).max(120),
    ownerName: z.string().trim().min(2).max(120),
    billDate: z.string().trim().min(8).max(40),
    billKind: z.enum(["customer", "merchant"]).optional().default("customer"),
    /** Settlement bills: resolve shop owner inbox when customerEmail is empty. */
    shopId: z.string().uuid().optional(),
    billNumber: z.string().trim().min(1).max(40).optional(),
    /** Sale bills and legacy paths - line items only. */
    items: z.array(sendCustomerBillLineItemSchema).optional(),
    /** Customer orders - same rows/totals as print preview. */
    orderBill: customerOrderBillEmailSchema.optional(),
  })
  .refine((d) => Boolean(d.orderBill) || (d.items?.length ?? 0) > 0, {
    message: "Provide orderBill or at least one line item",
    path: ["items"],
  });

export const sendWorkConfirmationSchema = z.object({
  requesterToken: z.string().min(10),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(2000),
});

export const sendPasswordResetSchema = z.object({
  email: z.string().trim().email().max(255),
  redirectTo: z.string().trim().url().optional().or(z.literal("")),
});
