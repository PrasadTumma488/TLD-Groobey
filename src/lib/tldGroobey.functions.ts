import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const roleSchema = z.enum(["main_admin", "admin", "merchant", "employee"]);
const staffRoles = new Set(["merchant", "employee"]);

const createAccountSchema = z
  .object({
    requesterToken: z.string().optional(),
    displayName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
    password: z.string().min(8).max(72),
    role: roleSchema,
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or mobile number is required",
    path: ["email"],
  });

const shopDetailsSchema = z.object({
  requesterToken: z.string().min(10),
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

async function hasMainAdmin() {
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "main_admin");

  if (error) throw new Error(error.message);
  return Boolean(count && count > 0);
}

async function assertMainAdmin(token?: string) {
  if (!token) throw new Error("Owner login is required to create accounts.");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Session expired. Please login again.");

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "main_admin")
    .maybeSingle();

  if (roleError) throw new Error(roleError.message);
  if (!role) throw new Error("Only the owner can create staff accounts.");
}

async function getAuthenticatedUser(token?: string) {
  if (!token) throw new Error("Login is required.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Session expired. Please login again.");
  return data.user;
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => createAccountSchema.parse(input))
  .handler(async ({ data }) => {
    const mainAdminExists = await hasMainAdmin();

    if (!mainAdminExists && data.role !== "main_admin") {
      throw new Error("Create the owner account first.");
    }

    if (mainAdminExists) {
      await assertMainAdmin(data.requesterToken);
      if (!staffRoles.has(data.role)) {
        throw new Error("Owner can create only merchant and employee/delivery boy logins.");
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email || undefined,
      phone: data.phone || undefined,
      password: data.password,
      email_confirm: Boolean(data.email),
      phone_confirm: Boolean(data.phone),
      user_metadata: { display_name: data.displayName, role: data.role },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Unable to create account.");
    }

    const userId = authData.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      display_name: data.displayName,
      email: data.email || null,
      phone: data.phone || null,
    } as never);

    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
    } as never);

    if (roleError) throw new Error(roleError.message);

    return { ok: true, userId };
  });

export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => ({
  hasOwner: await hasMainAdmin(),
}));

export const saveShopDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => shopDetailsSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser(data.requesterToken);

    const { error } = await supabaseAdmin.from("shops").insert({
      name: data.name,
      contact_name: data.contactName || null,
      phone: data.phone || null,
      address: data.address || null,
      created_by: user.id,
      is_active: true,
    } as never);

    if (error) throw new Error(error.message);
    return { ok: true };
  });