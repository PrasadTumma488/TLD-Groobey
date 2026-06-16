import { getRequest } from "@tanstack/react-start/server";
import { createClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { parseRoleFromAuthClaims } from "@/lib/groobey-auth-role";
import { isGroobeyPlatformAdminEmail } from "@/lib/groobey-platform-admin";
import {
  applyPendingStaffRolesForUser,
  findUserIdByEmail,
  listPendingStaffEmailAssignments,
  upsertStaffEmailAssignment,
} from "@/lib/groobey-staff-email-assignments.server";
import {
  getPlatformAdminEmailsResolved,
  getPlatformAdminUserIdsResolved,
} from "@/lib/platform-admin-bootstrap.server";
import { registerCustomerSchema, requesterTokenSchema } from "@/lib/tldGroobey.functions-schemas";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import { buildBillDeliveryEmail } from "@/lib/groobey-bill-email.server";
import { resolveBillQtyAndKgs, stripPackFromItemName } from "@/lib/groobey-bill-qty";
import { clampMarginPercent, tradeUnitFromRetail } from "@/lib/groobey-trade-margin";
import {
  buildGroobeyBillPdfBuffer,
  groobeyBillPdfFilename,
} from "@/lib/groobey-bill-pdf.server";
import {
  billIdMetaRowsForKind,
  groobeyBillColumnsForKind,
  groobeyBillTitleForKind,
} from "@/lib/groobey-bill-template";
import {
  buildCustomerOrderBillContent,
  customerOrderBillTotals,
  type CustomerOrderBillSource,
} from "@/lib/groobey-dual-bill";
import { formatInr, formatInrForPdf } from "@/lib/groobey-currency";
import {
  billEmailDevRedirectBannerHtml,
  billEmailDevRedirectBannerText,
  billEmailDeliveryPublicSnapshot,
  getResendApiKeyFromEnv,
  getResendFromEmail,
  getResendRedirectTo,
  isResendTestingOrDomainLimitError,
  normalizeBillRecipientEmail,
  resendCanEmailExternalRecipients,
  resendDomainFailureHint,
  resendSandboxSenderExplanation,
  resendTestingAllowlistedTo,
  trimResendEnv,
} from "@/lib/groobey-resend";
import { sendResendEmail } from "@/lib/groobey-resend-send.server";
import {
  applyShopCombosSchema,
  shopCombosTableExists,
} from "@/lib/groobey-shop-combos-schema.server";
import {
  applyProductsOutOfStockSchema,
  productsOutOfStockColumnExists,
} from "@/lib/groobey-products-out-of-stock-schema.server";
import {
  getServiceRoleKeyFromEnv,
  isPublishableKeyUsedAsServiceRole,
} from "@/lib/supabase-service-role-env";

const roleSchema = z.enum(["main_admin", "admin", "merchant", "employee", "order_taker"]);
const staffRoles = new Set(["merchant", "employee", "order_taker"]);

type AppRole = Database["public"]["Enums"]["app_role"];

type StaffDirectoryRoleRow = {
  user_id: string;
  role: AppRole;
  created_at: string;
};

/** Users who can log in with merchant/employee/order_taker in JWT but have no `user_roles` row yet. */
async function fetchStaffDirectoryRowsFromAuth(): Promise<StaffDirectoryRoleRow[]> {
  const out: StaffDirectoryRoleRow[] = [];
  const seenUser = new Set<string>();
  let page = 1;
  const perPage = 200;
  const maxPages = 50;

  while (page <= maxPages) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    for (const user of users) {
      const role = parseRoleFromAuthClaims(user);
      if (!role || !staffRoles.has(role)) continue;
      if (seenUser.has(user.id)) continue;
      seenUser.add(user.id);
      const created =
        typeof user.created_at === "string" && user.created_at
          ? user.created_at
          : new Date().toISOString();
      out.push({ user_id: user.id, role, created_at: created });
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return out;
}

function runtimeEnv(key: string): string {
  const v = Reflect.get(process.env, key);
  return typeof v === "string" ? v.trim() : "";
}

function getSupabaseUrl() {
  return runtimeEnv("SUPABASE_URL") || runtimeEnv("VITE_SUPABASE_URL");
}

function getPublishableKey() {
  return runtimeEnv("SUPABASE_PUBLISHABLE_KEY") || runtimeEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
}

function createOwnerScopedClient(token: string) {
  const url = getSupabaseUrl();
  const key = getPublishableKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL/publishable key for server actions. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.",
    );
  }
  return createClient<Database>(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function hasServiceRoleKey() {
  const k = getServiceRoleKeyFromEnv();
  if (!k) return false;
  if (isPublishableKeyUsedAsServiceRole(k)) return false;
  return true;
}

/** Prefer `user.email`, then OAuth / linked identity emails (JWT `getUser` sometimes omits the former). */
function primaryEmailFromUser(user: User): string | undefined {
  const direct = user.email?.trim();
  if (direct) return direct;
  for (const identity of user.identities ?? []) {
    const data = identity.identity_data;
    if (!data || typeof data !== "object") continue;
    const email = (data as { email?: unknown }).email;
    if (typeof email === "string") {
      const trimmed = email.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function buildPlatformAdminDeniedMessage(user: User) {
  const allowlistConfigured =
    Boolean(getPlatformAdminEmailsResolved()) || Boolean(getPlatformAdminUserIdsResolved());
  const primary = primaryEmailFromUser(user);
  const uidLine = `Your Auth user id: ${user.id}. Add PLATFORM_ADMIN_USER_IDS=${user.id} to server .env (with SUPABASE_SERVICE_ROLE_KEY), restart Vite ΓÇö or run the INSERT in Supabase Dashboard ΓåÆ SQL Editor (editing supabase/grant_platform_admin.sql in the repo alone does not change the database).`;
  const manualGrant =
    'In Supabase: run the INSERT from supabase/grant_platform_admin.sql in the SQL Editor (cloud), or Authentication ΓåÆ Users ΓåÆ your account ΓåÆ User metadata JSON: {"role":"main_admin"}, then sign out and sign in again.';
  if (!hasServiceRoleKey()) {
    return `Only platform admins can use this. The server must load SUPABASE_SERVICE_ROLE_KEY (and URL); see .env.example and restart. ${manualGrant} ${uidLine}`;
  }
  if (allowlistConfigured && !primary) {
    return `Only platform admins can use this. PLATFORM_ADMIN_EMAILS is set, but this Auth user has no email (e.g. phone-only), so the allowlist cannot match. ${manualGrant} ${uidLine}`;
  }
  if (allowlistConfigured) {
    return `Only platform admins can use this. Ensure your login email is listed in PLATFORM_ADMIN_EMAILS (comma-separated), then restart the server. ${manualGrant} ${uidLine}`;
  }
  return `Only platform admins can use this. Set PLATFORM_ADMIN_EMAILS or PLATFORM_ADMIN_USER_IDS in server .env, restart Vite, or run the SQL in Supabase (not only in the repo file). ${uidLine}`;
}

/** Only hardcoded Groobey platform admin emails may bootstrap or use admin APIs. */
function isPlatformAdminEmailAllowlisted(email: string | undefined): boolean {
  return isGroobeyPlatformAdminEmail(email);
}

/** Comma- or newline-separated Auth user UUIDs ΓåÆ same bootstrap as PLATFORM_ADMIN_EMAILS (requires service role). */
function isPlatformAdminUuidAllowlisted(userId: string | undefined): boolean {
  const raw = getPlatformAdminUserIdsResolved();
  if (!userId?.trim() || !raw) return false;
  const id = userId.trim().toLowerCase();
  const allow = new Set(
    raw
      .split(/[,;\n\r]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allow.has(id);
}

function sessionHasPlatformAdminRole(roles: AppRole[]) {
  return roles.some((r) => r === "main_admin" || r === "admin");
}

async function maybeBootstrapAllowlistedPlatformAdmin(
  user: User,
  dbRoles: AppRole[],
  metadataRole: AppRole | null,
): Promise<{ dbRoles: AppRole[]; metadataRole: AppRole | null; combined: AppRole[] }> {
  const combined: AppRole[] = metadataRole ? [...dbRoles, metadataRole] : dbRoles;
  const emailListed = isPlatformAdminEmailAllowlisted(primaryEmailFromUser(user));
  const uuidListed = isPlatformAdminUuidAllowlisted(user.id);
  if (
    !hasServiceRoleKey() ||
    sessionHasPlatformAdminRole(combined) ||
    (!emailListed && !uuidListed)
  ) {
    return { dbRoles, metadataRole, combined };
  }
  const { error } = await supabaseAdmin.from("user_roles").insert({
    user_id: user.id,
    role: "main_admin",
  } as never);
  if (error && !/duplicate|already exists|unique constraint/i.test(error.message)) {
    throw new Error(
      `Could not insert platform admin role (user_roles). Common cause: SUPABASE_SERVICE_ROLE_KEY is the publishable/anon key instead of the secret service_role key ΓÇö check Supabase ΓåÆ Project Settings ΓåÆ API. Supabase error: ${error.message}`,
    );
  }
  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleErr) {
    return { dbRoles, metadataRole, combined };
  }
  const nextDb = (roleRows ?? []).map((r) => r.role);
  const meta = parseRoleFromAuthClaims(user);
  const nextCombined: AppRole[] = meta ? [...nextDb, meta] : nextDb;
  return { dbRoles: nextDb, metadataRole: meta, combined: nextCombined };
}

async function bootstrapAllowlistedRolesForUser(
  user: User,
  dbRoles: AppRole[],
  metadataRole: AppRole | null,
) {
  const adminStep = await maybeBootstrapAllowlistedPlatformAdmin(user, dbRoles, metadataRole);
  await applyPendingStaffRolesForUser(user);
  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleErr) return adminStep;
  const nextDb = (roleRows ?? []).map((r) => r.role);
  const meta = parseRoleFromAuthClaims(user);
  const nextCombined: AppRole[] = meta ? [...nextDb, meta] : nextDb;
  return { dbRoles: nextDb, metadataRole: meta, combined: nextCombined };
}

/** After `assertAdminOrMain`: RLS only trusts `user_roles`, not JWT. Use service role for cross-user reads/writes when configured. */
function platformAdminDataActor(requesterToken: string) {
  return hasServiceRoleKey() ? supabaseAdmin : createOwnerScopedClient(requesterToken);
}

/** Prefer body token; fall back to `Authorization: Bearer ΓÇª` from the server request (client can send both). */
function resolveRequesterBearerFromRequest(data: { requesterToken?: string }): string {
  const fromBody = data.requesterToken?.trim();
  if (fromBody) return fromBody;
  try {
    const request = getRequest();
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice("Bearer ".length).trim();
      if (token) return token;
    }
  } catch {
    // getRequest() is only valid during an HTTP request on the server.
  }
  return "";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(rawPhone?: string) {
  const value = (rawPhone ?? "").trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return value;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function roleCodeForGroobey(role: Database["public"]["Enums"]["app_role"]) {
  if (role === "main_admin" || role === "admin") return "PA";
  if (role === "merchant") return "SO";
  if (role === "order_taker") return "OT";
  return "DB";
}

function pickHighestRole(
  roles: Database["public"]["Enums"]["app_role"][],
): Database["public"]["Enums"]["app_role"] | null {
  if (roles.includes("main_admin")) return "main_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("merchant")) return "merchant";
  if (roles.includes("order_taker")) return "order_taker";
  if (roles.includes("employee")) return "employee";
  return null;
}

function nextSequenceFromCodes(
  codes: Array<string | null | undefined>,
  extract: (value: string) => number | null,
) {
  let max = 0;
  for (const code of codes) {
    const value = (code ?? "").trim();
    if (!value) continue;
    const numeric = extract(value);
    if (numeric !== null && Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return max + 1;
}

async function generateGroobeyCode(
  client: ReturnType<typeof createOwnerScopedClient> | typeof supabaseAdmin,
  role: Database["public"]["Enums"]["app_role"],
  seqOffset = 0,
) {
  const roleCode = roleCodeForGroobey(role);
  if (roleCode === "PA") {
    const prefix = "TLDG-PA-488";
    const { data, error } = await client
      .from("profiles")
      .select("groobey_code")
      .ilike("groobey_code", `${prefix}%`);
    if (error) throw new Error(error.message);
    const seq =
      nextSequenceFromCodes(
        (data ?? []).map((row) => row.groobey_code),
        (value) => {
          if (!value.startsWith(prefix)) return null;
          const n = Number(value.slice(prefix.length));
          return Number.isFinite(n) ? n : null;
        },
      ) + seqOffset;
    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  const now = new Date();
  const yy = pad2(now.getUTCFullYear() % 100);
  const mm = pad2(now.getUTCMonth() + 1);
  const prefix = `TLDG-${roleCode}-488${yy}${mm}`;
  const { data, error } = await client
    .from("profiles")
    .select("groobey_code")
    .ilike("groobey_code", `${prefix}%`);
  if (error) throw new Error(error.message);
  const seq =
    nextSequenceFromCodes(
      (data ?? []).map((row) => row.groobey_code),
      (value) => {
        if (!value.startsWith(prefix)) return null;
        const n = Number(value.slice(prefix.length));
        return Number.isFinite(n) ? n : null;
      },
    ) + seqOffset;
  return `${prefix}${pad2(seq)}`;
}

function isGroobeyCodeDuplicateError(message: string): boolean {
  return /profiles_groobey_code_key|duplicate key.*groobey_code/i.test(message);
}

/** Pick a Groobey ID that is not already on another profile (retries + DB check). */
async function allocateUniqueGroobeyCode(
  client: ReturnType<typeof createOwnerScopedClient> | typeof supabaseAdmin,
  role: Database["public"]["Enums"]["app_role"],
  options?: { excludeUserId?: string; existingCode?: string | null },
): Promise<string> {
  const keep = options?.existingCode?.trim();
  if (keep) {
    const { data: row, error } = await client
      .from("profiles")
      .select("user_id")
      .eq("groobey_code", keep)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id === options?.excludeUserId) return keep;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = await generateGroobeyCode(client, role, attempt);
    const { data: row, error } = await client
      .from("profiles")
      .select("user_id")
      .eq("groobey_code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id === options?.excludeUserId) return code;
  }

  throw new Error(
    "Could not allocate a unique Groobey ID. Open Platform Admin again to sync IDs, then retry.",
  );
}

const createAccountSchema = z
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

const shopDetailsSchema = z.object({
  requesterToken: z.string().min(10),
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

/** True if any platform-level account exists (main owner or admin). */
async function hasPlatformBootstrapAccount() {
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .in("role", ["main_admin", "admin"]);

  if (error) throw new Error(error.message);
  return Boolean(count && count > 0);
}

/**
 * DB roles plus JWT role claims (same merge idea as `resolvePrimaryDashboard` / `ensureMyGroobeyCode`).
 * When `SUPABASE_SERVICE_ROLE_KEY` is set, uses the admin client to validate the JWT and read
 * `user_roles` so server env anon key mismatches cannot break session checks.
 */
async function loadSessionRolesMerged(token: string) {
  if (hasServiceRoleKey()) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return null;
    const user = authData.user;
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (roleError) throw new Error(roleError.message);
    const dbRoles = (roleRows ?? []).map((r) => r.role);
    const metadataRole = parseRoleFromAuthClaims(user);
    const merged = await bootstrapAllowlistedRolesForUser(user, dbRoles, metadataRole);
    return { user, dbRoles: merged.dbRoles, metadataRole: merged.metadataRole, combined: merged.combined };
  }

  const ownerClient = createOwnerScopedClient(token);
  const { data, error } = await ownerClient.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: roleRows, error: roleError } = await ownerClient
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  if (roleError) throw new Error(roleError.message);

  const dbRoles = (roleRows ?? []).map((r) => r.role);
  const metadataRole = parseRoleFromAuthClaims(data.user);
  const merged = await bootstrapAllowlistedRolesForUser(data.user, dbRoles, metadataRole);
  return {
    user: data.user,
    dbRoles: merged.dbRoles,
    metadataRole: merged.metadataRole,
    combined: merged.combined,
  };
}

export async function bootstrapAllowlistedRolesHandler(ctx: { data: unknown }) {
  const parsed = requesterTokenSchema.parse(ctx.data);
  const token = resolveRequesterBearerFromRequest(parsed) || parsed.requesterToken;
  const session = await loadSessionRolesMerged(token);
  if (!session) throw new Error("Session expired. Please sign in again.");
  return { ok: true as const, roles: session.combined };
}

export async function ensureMyShopSlugHandler(ctx: { data: unknown }) {
  const parsed = requesterTokenSchema.parse(ctx.data);
  const token = resolveRequesterBearerFromRequest(parsed) || parsed.requesterToken;
  const session = await loadSessionRolesMerged(token);
  if (!session) throw new Error("Session expired. Please sign in again.");
  const { ensureProfileShopSlug } = await import("@/lib/groobey-profile-slug.server");
  const slug = await ensureProfileShopSlug(
    session.user.id,
    session.user.user_metadata?.display_name as string | undefined,
    session.user.email,
  );
  return { ok: true as const, slug };
}

async function assertAdminOrMain(token?: string) {
  if (!token) throw new Error("Owner login is required.");
  let session = await loadSessionRolesMerged(token);
  if (!session) throw new Error("Session expired. Please login again.");

  if (!sessionHasPlatformAdminRole(session.combined) && hasServiceRoleKey()) {
    const { data: adminFetch, error: adminErr } = await supabaseAdmin.auth.admin.getUserById(
      session.user.id,
    );
    if (!adminErr && adminFetch?.user) {
      const u = adminFetch.user;
      const fromAdminApi = parseRoleFromAuthClaims(u);
      const { data: roleRows, error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);
      if (!roleErr) {
        const dbRoles = (roleRows ?? []).map((r) => r.role);
        const merged = await maybeBootstrapAllowlistedPlatformAdmin(u, dbRoles, fromAdminApi);
        if (sessionHasPlatformAdminRole(merged.combined)) {
          session = {
            user: u,
            dbRoles: merged.dbRoles,
            metadataRole: merged.metadataRole,
            combined: merged.combined,
          };
        }
      }
    }
  }

  if (!sessionHasPlatformAdminRole(session.combined)) {
    throw new Error(buildPlatformAdminDeniedMessage(session.user));
  }

  if (!isGroobeyPlatformAdminEmail(primaryEmailFromUser(session.user))) {
    throw new Error(
      "This account is not authorized for platform admin access. Use an approved administrator email.",
    );
  }

  const dbHasPlatformRole = sessionHasPlatformAdminRole(session.dbRoles);
  if (
    hasServiceRoleKey() &&
    !dbHasPlatformRole &&
    session.metadataRole &&
    (session.metadataRole === "main_admin" || session.metadataRole === "admin")
  ) {
    const { error: insertErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: session.user.id,
      role: session.metadataRole,
    } as never);
    if (insertErr && !/duplicate|already exists|unique constraint/i.test(insertErr.message)) {
      throw new Error(insertErr.message);
    }
  }
}

async function isPlatformAdminSession(token?: string): Promise<boolean> {
  if (!token?.trim()) return false;
  const session = await loadSessionRolesMerged(token);
  if (!session) return false;
  return sessionHasPlatformAdminRole(session.combined);
}

async function getAuthenticatedUser(token?: string) {
  if (!token) throw new Error("Login is required.");
  const ownerClient = createOwnerScopedClient(token);
  const { data, error } = await ownerClient.auth.getUser(token);
  if (error || !data.user) throw new Error("Session expired. Please login again.");
  return data.user;
}

export async function createStaffAccountHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const normalizedPhone = normalizePhone(data.phone);
    const requesterBearer = resolveRequesterBearerFromRequest(data);

    if (data.role === "main_admin" || data.role === "admin") {
      throw new Error(
        "Platform admin accounts cannot be created here. Sign in with an authorized administrator email.",
      );
    }

    if (!requesterBearer) {
      throw new Error("Your session was not sent to the server. Refresh the page and try again.");
    }
    await assertAdminOrMain(requesterBearer);
    if (!staffRoles.has(data.role)) {
      throw new Error("Platform admin can create only shop owner, delivery boy, and order taker logins.");
    }

    const emailTrimmed = String(data.email || "")
      .trim()
      .toLowerCase();
    const displayName = String(data.displayName || "").trim();

    /** Delivery boys register as customers first; admin only assigns their email. */
    if (data.role === "employee" && hasServiceRoleKey()) {
      if (!emailTrimmed) throw new Error("Delivery boy email is required.");
      const session = await loadSessionRolesMerged(requesterBearer);
      const existingUserId = await findUserIdByEmail(emailTrimmed);
      if (existingUserId) {
        const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
          { user_id: existingUserId, role: "employee" } as never,
          { onConflict: "user_id,role" },
        );
        if (roleError) throw new Error(roleError.message);
        if (displayName) {
          await supabaseAdmin
            .from("profiles")
            .update({ display_name: displayName } as never)
            .eq("user_id", existingUserId);
        }
        await supabaseAdmin.from("staff_email_assignments").delete().eq("email", emailTrimmed);
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("groobey_code")
          .eq("user_id", existingUserId)
          .maybeSingle();
        return {
          ok: true,
          userId: existingUserId,
          groobeyId: prof?.groobey_code ?? null,
        };
      }
      await upsertStaffEmailAssignment({
        email: emailTrimmed,
        role: "employee",
        displayName,
        assignedBy: session?.user.id,
      });
      return {
        ok: true,
        pendingSignup: true as const,
        email: emailTrimmed,
        displayName,
      };
    }

    if (hasServiceRoleKey()) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailTrimmed || undefined,
        phone: normalizedPhone || undefined,
        password: data.password,
        // Confirm immediately so Order Taker / Staff can sign in without waiting for email flow.
        email_confirm: Boolean(emailTrimmed),
        phone_confirm: Boolean(normalizedPhone),
        user_metadata: { display_name: data.displayName, role: data.role },
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Unable to create account.");
      }

      const userId = authData.user.id;
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("groobey_code")
        .eq("user_id", userId)
        .maybeSingle();
      let groobeyCode = await allocateUniqueGroobeyCode(supabaseAdmin, data.role, {
        excludeUserId: userId,
        existingCode: existingProfile?.groobey_code,
      });
      try {
        let profileError: { message: string } | null = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { error } = await supabaseAdmin.from("profiles").upsert(
            {
              user_id: userId,
              display_name: data.displayName,
              email: emailTrimmed || null,
              phone: normalizedPhone || null,
              groobey_code: groobeyCode,
              is_active: true,
            } as never,
            { onConflict: "user_id" },
          );
          if (!error) {
            profileError = null;
            break;
          }
          if (isGroobeyCodeDuplicateError(error.message) && attempt < 4) {
            groobeyCode = await allocateUniqueGroobeyCode(supabaseAdmin, data.role, {
              excludeUserId: userId,
            });
            continue;
          }
          profileError = error;
          break;
        }

        if (profileError) throw new Error(profileError.message);

        const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
          {
            user_id: userId,
            role: data.role,
          } as never,
          { onConflict: "user_id,role" },
        );

        if (roleError) throw new Error(roleError.message);
      } catch (e) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {
          /* best-effort rollback */
        });
        const msg = e instanceof Error ? e.message : "Unable to save profile or role.";
        throw new Error(
          `${msg} The new login was removed from Authentication so you can retry with the same email or phone.`,
        );
      }

      return { ok: true, userId, groobeyId: groobeyCode };
    }

    if (!requesterBearer) {
      throw new Error("Owner login is required to create staff accounts.");
    }
    await assertAdminOrMain(requesterBearer);
    if (!staffRoles.has(data.role)) {
      throw new Error("Owner can create only shop owner, staff, and order taker logins.");
    }
    if (!data.email) {
      throw new Error(
        "Without service role key, create staff with email login (phone-only needs service role).",
      );
    }

    const ownerClient = createOwnerScopedClient(requesterBearer);
    const email = data.email.trim().toLowerCase();
    const { data: signUpData, error: signUpError } = await ownerClient.auth.signUp({
      email,
      password: data.password,
      options: {
        data: { display_name: data.displayName, role: data.role },
      },
    });
    if (signUpError) {
      const msg = signUpError.message || "Unable to create account.";
      if (/already|registered|exists/i.test(msg)) {
        throw new Error("This email is already registered. Use Edit for that staff account.");
      }
      throw new Error(msg);
    }
    const identities = signUpData.user?.identities ?? [];
    // Supabase may return an obfuscated user object for already-registered emails.
    // That id is not guaranteed to exist in auth.users and will fail FK on user_roles.
    if (signUpData.user && identities.length === 0) {
      throw new Error("This email is already registered. Use Edit for that staff account.");
    }
    const userId = signUpData.user?.id ?? null;

    if (!userId) {
      throw new Error(
        "Unable to resolve user id for this email. Please try a different email or enable SUPABASE_SERVICE_ROLE_KEY for admin user creation.",
      );
    }

    const { data: existingProfile } = await ownerClient
      .from("profiles")
      .select("groobey_code")
      .eq("user_id", userId)
      .maybeSingle();
    let groobeyCode = await allocateUniqueGroobeyCode(ownerClient, data.role, {
      excludeUserId: userId,
      existingCode: existingProfile?.groobey_code,
    });
    let profileError: { message: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { error } = await ownerClient.from("profiles").upsert(
        {
          user_id: userId,
          display_name: data.displayName,
          email,
          phone: normalizedPhone || null,
          groobey_code: groobeyCode,
          is_active: true,
        } as never,
        { onConflict: "user_id" },
      );
      if (!error) {
        profileError = null;
        break;
      }
      if (isGroobeyCodeDuplicateError(error.message) && attempt < 4) {
        groobeyCode = await allocateUniqueGroobeyCode(ownerClient, data.role, {
          excludeUserId: userId,
        });
        continue;
      }
      profileError = error;
      break;
    }
    if (profileError) throw new Error(profileError.message);

    let roleErrorMessage: string | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { error: roleError } = await ownerClient.from("user_roles").upsert(
        {
          user_id: userId,
          role: data.role,
        } as never,
        { onConflict: "user_id,role" },
      );
      if (!roleError) {
        roleErrorMessage = null;
        break;
      }
      roleErrorMessage = roleError.message;
      // Supabase auth user row may take a moment before FK checks can see it.
      if (!/foreign key|user_roles_user_id_fkey/i.test(roleError.message)) break;
      await sleep(250 * (attempt + 1));
    }
    if (roleErrorMessage) throw new Error(roleErrorMessage);

    return { ok: true, userId, groobeyId: groobeyCode };
}

export async function getSetupStatusHandler() {
  const hasServiceRoleKeyConfigured = hasServiceRoleKey();
  let hasOwner = false;
  if (hasServiceRoleKeyConfigured) {
    try {
      hasOwner = await hasPlatformBootstrapAccount();
    } catch {
      hasOwner = false;
    }
  }
  return {
    hasOwner,
    hasServiceRoleKey: hasServiceRoleKeyConfigured,
  };
}

export async function syncGroobeyCodesHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const ownerClient = createOwnerScopedClient(data.requesterToken);
    await assertAdminOrMain(data.requesterToken);
    const requester = await getAuthenticatedUser(data.requesterToken);
    const actorClient = hasServiceRoleKey() ? supabaseAdmin : ownerClient;

    const { data: profiles, error: profileError } = await actorClient
      .from("profiles")
      .select("user_id, created_at, groobey_code");
    if (profileError) throw new Error(profileError.message);

    const { data: roles, error: roleError } = await actorClient
      .from("user_roles")
      .select("user_id, role");
    if (roleError) throw new Error(roleError.message);

    const roleRank = (role: Database["public"]["Enums"]["app_role"]) =>
      role === "main_admin" || role === "admin" ? 3 : role === "merchant" ? 2 : role === "employee" ? 1 : 0;
    const roleByUser = new Map<string, Database["public"]["Enums"]["app_role"]>();
    for (const row of roles ?? []) {
      const prev = roleByUser.get(row.user_id);
      if (!prev || roleRank(row.role) > roleRank(prev)) roleByUser.set(row.user_id, row.role);
    }

    // Ensure profile row exists for role users (needed for code generation).
    const profileUserIds = new Set((profiles ?? []).map((row) => row.user_id));
    const missingProfileUserIds = [...roleByUser.keys()].filter((uid) => !profileUserIds.has(uid));
    if (missingProfileUserIds.length && hasServiceRoleKey()) {
      for (const userId of missingProfileUserIds) {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authErr || !authUser?.user) continue;
        const u = authUser.user;
        const displayName =
          String(u.user_metadata?.display_name || "").trim() ||
          u.email?.trim() ||
          u.phone?.trim() ||
          "User";
        const phone = normalizePhone(u.phone || "");
        const { error: insErr } = await supabaseAdmin.from("profiles").insert({
          user_id: userId,
          display_name: displayName,
          email: u.email?.trim() || null,
          phone: phone || null,
          is_active: true,
        } as never);
        if (!insErr) {
          profileUserIds.add(userId);
        }
      }
    }
    if (missingProfileUserIds.includes(requester.id) && !hasServiceRoleKey()) {
      const displayName =
        String(requester.user_metadata?.display_name || "").trim() ||
        requester.email?.trim() ||
        requester.phone?.trim() ||
        "User";
      const { error: ownInsertError } = await ownerClient.from("profiles").upsert(
        {
          user_id: requester.id,
          display_name: displayName,
          email: requester.email?.trim() || null,
          phone: normalizePhone(requester.phone || "") || null,
          is_active: true,
        } as never,
        { onConflict: "user_id" },
      );
      if (ownInsertError) throw new Error(ownInsertError.message);
    }

    const { data: profilesAfter, error: profilesAfterError } = await actorClient
      .from("profiles")
      .select("user_id, created_at, groobey_code");
    if (profilesAfterError) throw new Error(profilesAfterError.message);

    const profileRows = (profilesAfter ?? [])
      .map((row) => {
        const role = roleByUser.get(row.user_id);
        if (!role) return null;
        const created = new Date(row.created_at || 0);
        return {
          userId: row.user_id,
          createdAt: Number.isFinite(created.getTime()) ? created : new Date(0),
          role,
          groobeyCode: row.groobey_code,
        };
      })
      .filter(Boolean) as Array<{
      userId: string;
      createdAt: Date;
      role: Database["public"]["Enums"]["app_role"];
      groobeyCode: string | null;
    }>;

    const targets = new Map<string, string>();

    // Platform Admin: global permanent sequence (001, 002...)
    const paRows = profileRows
      .filter((row) => roleCodeForGroobey(row.role) === "PA")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.userId.localeCompare(b.userId));
    paRows.forEach((row, i) => {
      targets.set(row.userId, `TLDG-PA-488${String(i + 1).padStart(3, "0")}`);
    });

    // Shop Owner + Delivery boy + Order taker: monthly sequence based on YYMM (01, 02...)
    const monthlyRows = profileRows
      .filter((row) => roleCodeForGroobey(row.role) !== "PA")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.userId.localeCompare(b.userId));
    const seqByBucket = new Map<string, number>();
    for (const row of monthlyRows) {
      const roleCode = roleCodeForGroobey(row.role);
      const yy = pad2(row.createdAt.getUTCFullYear() % 100);
      const mm = pad2(row.createdAt.getUTCMonth() + 1);
      const bucket = `${roleCode}-${yy}${mm}`;
      const next = (seqByBucket.get(bucket) ?? 0) + 1;
      seqByBucket.set(bucket, next);
      targets.set(row.userId, `TLDG-${roleCode}-488${yy}${mm}${pad2(next)}`);
    }

    const toReassign = profileRows.filter((row) => {
      const nextCode = targets.get(row.userId);
      return nextCode && row.groobeyCode !== nextCode;
    });

    // Two-phase update: clearing first avoids unique-index collisions when IDs are reshuffled.
    for (const row of toReassign) {
      const { error } = await actorClient
        .from("profiles")
        .update({ groobey_code: null } as never)
        .eq("user_id", row.userId);
      if (error) {
        if (!hasServiceRoleKey() && row.userId !== requester.id) continue;
        throw new Error(error.message);
      }
    }

    let updated = 0;
    for (const row of toReassign) {
      const nextCode = targets.get(row.userId);
      if (!nextCode) continue;
      const { error } = await actorClient
        .from("profiles")
        .update({ groobey_code: nextCode } as never)
        .eq("user_id", row.userId);
      if (error) {
        if (!hasServiceRoleKey() && row.userId !== requester.id) continue;
        throw new Error(error.message);
      }
      updated += 1;
    }

    return { ok: true as const, updated };
}

export async function ensureMyGroobeyCodeHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const ownerClient = createOwnerScopedClient(data.requesterToken);
    const user = await getAuthenticatedUser(data.requesterToken);

    const { data: roleRows, error: roleError } = await ownerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (roleError) throw new Error(roleError.message);

    const dbRoles = (roleRows ?? []).map((row) => row.role);
    const metadataRole = parseRoleFromAuthClaims(user);
    const role = pickHighestRole(metadataRole ? [...dbRoles, metadataRole] : dbRoles);
    if (!role) {
      throw new Error("Could not determine role for Groobey ID generation.");
    }

    const { data: ownProfile, error: ownProfileErr } = await ownerClient
      .from("profiles")
      .select("groobey_code")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownProfileErr) throw new Error(ownProfileErr.message);
    if (ownProfile?.groobey_code?.trim()) {
      return { ok: true as const, groobeyId: ownProfile.groobey_code };
    }

    const displayName =
      String(user.user_metadata?.display_name || "").trim() ||
      user.email?.trim() ||
      user.phone?.trim() ||
      "User";
    const phone = normalizePhone(user.phone || "");
    const { error: upsertErr } = await ownerClient.from("profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName,
        email: user.email?.trim() || null,
        phone: phone || null,
        is_active: true,
      } as never,
      { onConflict: "user_id" },
    );
    if (upsertErr) throw new Error(upsertErr.message);

    const actorClient = hasServiceRoleKey() ? supabaseAdmin : ownerClient;
    let code = await allocateUniqueGroobeyCode(actorClient, role, {
      excludeUserId: user.id,
      existingCode: ownProfile?.groobey_code,
    });
    let updateErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { error } = await ownerClient
        .from("profiles")
        .update({ groobey_code: code } as never)
        .eq("user_id", user.id);
      if (!error) {
        updateErr = null;
        break;
      }
      if (isGroobeyCodeDuplicateError(error.message) && attempt < 4) {
        code = await allocateUniqueGroobeyCode(actorClient, role, { excludeUserId: user.id });
        continue;
      }
      updateErr = error;
      break;
    }
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true as const, groobeyId: code };
}

export async function saveShopDetailsHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const user = await getAuthenticatedUser(data.requesterToken);
    const ownerClient = createOwnerScopedClient(data.requesterToken);

    const { error } = await ownerClient.from("shops").insert({
      name: data.name,
      contact_name: data.contactName || null,
      phone: data.phone || null,
      address: data.address || null,
      created_by: user.id,
      is_active: true,
    } as never);

    if (error) throw new Error(error.message);
    return { ok: true };
}

export async function listStaffAccountsHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
await assertAdminOrMain(data.requesterToken);
    // RLS `is_admin_or_main()` only looks at `user_roles`, not JWT metadata. Platform admins who only
    // had metadata (or a lag before backfill) would see an empty list via the user-scoped client.
    // After assertAdminOrMain, use service role for reads when available so the directory is complete.
    const actor = platformAdminDataActor(data.requesterToken);

    const { data: roleRows, error: roleError } = await actor
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", ["merchant", "employee", "order_taker"])
      .order("created_at", { ascending: false });

    if (roleError) throw new Error(roleError.message);

    const mergedByUser = new Map<string, StaffDirectoryRoleRow>();
    for (const row of roleRows ?? []) {
      mergedByUser.set(row.user_id, {
        user_id: row.user_id,
        role: row.role,
        created_at: row.created_at ?? new Date().toISOString(),
      });
    }

    if (hasServiceRoleKey()) {
      try {
        const authRows = await fetchStaffDirectoryRowsFromAuth();
        for (const row of authRows) {
          if (mergedByUser.has(row.user_id)) continue;
          mergedByUser.set(row.user_id, row);
          const { error: insErr } = await supabaseAdmin.from("user_roles").insert({
            user_id: row.user_id,
            role: row.role,
          } as never);
          if (insErr && !/duplicate|already exists|unique constraint/i.test(insErr.message)) {
            console.warn("[listStaffAccounts] user_roles backfill:", insErr.message);
          }
        }
      } catch (e) {
        console.warn("[listStaffAccounts] auth user scan failed:", e instanceof Error ? e.message : e);
      }
    }

    const merged = [...mergedByUser.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const pendingRows = hasServiceRoleKey() ? await listPendingStaffEmailAssignments() : [];

    if (!merged.length && !pendingRows.length) return { staff: [] as const };

    const userIds = merged.map((row) => row.user_id);
    const profById = new Map<
      string,
      {
        user_id: string;
        display_name: string | null;
        email: string | null;
        phone: string | null;
        is_active: boolean | null;
        created_at: string | null;
        groobey_code: string | null;
      }
    >();
    if (userIds.length) {
      const profileActor = hasServiceRoleKey() ? supabaseAdmin : actor;
      const { data: profs, error: profError } = await profileActor
        .from("profiles")
        .select("user_id, display_name, email, phone, is_active, created_at, groobey_code")
        .in("user_id", userIds);

      if (profError) throw new Error(profError.message);
      for (const profile of profs ?? []) {
        profById.set(profile.user_id, profile);
      }
    }

    return {
      staff: [
        ...merged.map((row) => {
          const profile = profById.get(row.user_id);
          return {
            userId: row.user_id,
            role: row.role,
            displayName: profile?.display_name ?? "",
            email: profile?.email ?? null,
            phone: profile?.phone ?? null,
            groobeyId: profile?.groobey_code ?? null,
            isActive: profile?.is_active ?? true,
            joinedAt: profile?.created_at ?? row.created_at ?? null,
            pendingSignup: false as const,
          };
        }),
        ...pendingRows.map((pending) => ({
          userId: `pending:${pending.email}`,
          role: pending.role,
          displayName: pending.displayName ?? "",
          email: pending.email,
          phone: null,
          groobeyId: null,
          isActive: true,
          joinedAt: pending.createdAt,
          pendingSignup: true as const,
        })),
      ],
    };
}

export async function setStaffAccountActiveHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
await assertAdminOrMain(data.requesterToken);
    const actor = platformAdminDataActor(data.requesterToken);

    const { data: targetRole, error: targetError } = await actor
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (targetError) throw new Error(targetError.message);
    if (targetRole?.role === "main_admin") {
      throw new Error("Cannot disable the owner account.");
    }
    if (
      targetRole?.role !== "merchant" &&
      targetRole?.role !== "employee" &&
      targetRole?.role !== "order_taker"
    ) {
      throw new Error("You can only manage shop owner, staff, and order taker accounts.");
    }

    const { error } = await actor
      .from("profiles")
      .update({ is_active: data.isActive } as never)
      .eq("user_id", data.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
}

export async function updateStaffAccountHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
await assertAdminOrMain(data.requesterToken);
    const actor = platformAdminDataActor(data.requesterToken);

    const { data: targetRole, error: targetError } = await actor
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (targetError) throw new Error(targetError.message);
    if (
      targetRole?.role !== "merchant" &&
      targetRole?.role !== "employee" &&
      targetRole?.role !== "order_taker"
    ) {
      throw new Error("You can only edit shop owner, staff, and order taker accounts.");
    }

    const normalizedPhone = normalizePhone(data.phone);
    const { error } = await actor
      .from("profiles")
      .update({
        display_name: data.displayName,
        email: data.email || null,
        phone: normalizedPhone || null,
      } as never)
      .eq("user_id", data.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
}

export async function updateMyProfileHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const user = await getAuthenticatedUser(data.requesterToken);
    const ownerClient = createOwnerScopedClient(data.requesterToken);
    const normalizedPhone = normalizePhone(data.phone);

    const { error } = await ownerClient.from("profiles").upsert(
      {
        user_id: user.id,
        display_name: data.displayName,
        email: data.email || null,
        phone: normalizedPhone || null,
        is_active: true,
      } as never,
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
}

export async function deleteStaffAccountHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
await assertAdminOrMain(data.requesterToken);
    const actor = platformAdminDataActor(data.requesterToken);

    const { data: targetRole, error: targetError } = await actor
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (targetError) throw new Error(targetError.message);
    if (
      targetRole?.role !== "merchant" &&
      targetRole?.role !== "employee" &&
      targetRole?.role !== "order_taker"
    ) {
      throw new Error("You can only delete shop owner, staff, and order taker accounts.");
    }

    // Hard-delete auth user when service-role is available.
    if (hasServiceRoleKey()) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (!deleteAuthError) return { ok: true };
    }

    // Fallback: disable profile and remove role so it disappears from staff directory.
    const { error: profileError } = await actor
      .from("profiles")
      .update({ is_active: false } as never)
      .eq("user_id", data.userId);
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await actor
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["merchant", "employee", "order_taker"]);
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
}

async function resolveShopOwnerEmailForShop(
  client: ReturnType<typeof createOwnerScopedClient>,
  shopId: string | undefined,
): Promise<string> {
  const id = shopId?.trim();
  if (!id) return "";
  const { data: shop, error: shopErr } = await client
    .from("shops")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();
  if (shopErr) throw new Error(shopErr.message);
  const ownerId = shop?.created_by?.trim();
  if (!ownerId) return "";
  const { data: profile, error: profErr } = await client
    .from("profiles")
    .select("email")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (profErr) throw new Error(profErr.message);
  return profile?.email?.trim() ?? "";
}

async function assertStaffCanSendBillEmail(
  data: Record<string, unknown>,
): Promise<{ user: Awaited<ReturnType<typeof getAuthenticatedUser>>; client: ReturnType<typeof createOwnerScopedClient> }> {
  const user = await getAuthenticatedUser(data.requesterToken);
  const client = createOwnerScopedClient(data.requesterToken);
  const { data: roleRows, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["main_admin", "merchant", "employee", "order_taker"]);
  if (roleError) throw new Error(roleError.message);
  if (!roleRows?.length) throw new Error("Only logged-in staff can send bill emails.");
  return { user, client };
}

export async function resolveShopOwnerEmailsHandler(ctx: { data: unknown }) {
  const { data } = ctx as { data: Record<string, unknown> };
  const shopIds = Array.isArray(data.shopIds)
    ? data.shopIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const { client } = await assertStaffCanSendBillEmail(data);
  const emails: Record<string, string> = {};
  for (const shopId of shopIds) {
    const email = await resolveShopOwnerEmailForShop(client, shopId);
    if (email) emails[shopId] = email;
  }
  return { emails };
}

export async function sendCustomerBillEmailHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const user = await getAuthenticatedUser(data.requesterToken);
    const ownerClient = createOwnerScopedClient(data.requesterToken);
    const ownOrderId = typeof data.orderId === "string" ? data.orderId.trim() : "";
    let ownOrderVerified = false;
    if (ownOrderId) {
      const { data: owned, error: ownErr } = await ownerClient
        .from("customer_orders")
        .select("id")
        .eq("id", ownOrderId)
        .eq("created_by", user.id)
        .maybeSingle();
      if (ownErr) throw new Error(ownErr.message);
      if (!owned) throw new Error("Order not found.");
      ownOrderVerified = true;
    }

    const { data: roleRows, error: roleError } = await ownerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["main_admin", "merchant", "employee", "order_taker"]);
    if (roleError) throw new Error(roleError.message);
    if (!roleRows?.length && !ownOrderVerified) {
      throw new Error("Only logged-in staff can send bill emails.");
    }

    const { data: senderProfile, error: senderProfErr } = await ownerClient
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (senderProfErr) throw new Error(senderProfErr.message);
    const senderEmail = senderProfile?.email?.trim() || user.email?.trim() || "";

    const billKind = data.billKind ?? "customer";
    let customerRef = normalizeBillRecipientEmail(data.customerEmail);

    if (billKind === "customer" && !customerRef && ownOrderVerified) {
      const { data: custProf, error: custProfErr } = await ownerClient
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (custProfErr) throw new Error(custProfErr.message);
      customerRef = normalizeBillRecipientEmail(custProf?.email ?? user.email ?? "");
    }

    if (billKind === "customer" && !customerRef) {
      throw new Error(
        "Enter the customer's email address. Customer bills are sent only to that inbox.",
      );
    }

    if (billKind === "merchant") {
      if (!customerRef) {
        customerRef = normalizeBillRecipientEmail(
          await resolveShopOwnerEmailForShop(
            ownerClient,
            typeof data.shopId === "string" ? data.shopId : undefined,
          ),
        );
      }
      if (!customerRef) {
        throw new Error(
          "Enter the shop owner's email, or link the order to a shop whose owner has an email on their profile.",
        );
      }
    }

    if (billKind === "customer" && !resendCanEmailExternalRecipients()) {
      throw new Error(
        "This deployment is still using Resend test mode for the sender address. " +
          resendSandboxSenderExplanation() +
          " Prefer RESEND_FROM_EMAIL (e.g. Groobey <bills@yourdomain.com>); the app also reads RESEND_MAIL_FROM, EMAIL_FROM, or VITE_RESEND_FROM_EMAIL (From only ΓÇö never put the API key in VITE_). " +
          "Customer bills always use the customer email as To; Resend only delivers once From uses your verified domain.",
      );
    }

    const targetEmail = customerRef;
    if (!targetEmail) {
      throw new Error(
        billKind === "customer" ?
          "Enter the customer's email address before sending the bill."
        : "Enter the shop owner's email before sending the settlement bill.",
      );
    }
    const billNo = data.billNumber?.trim();
    const title = billKind === "customer" ? "Bill" : "Settlement bill (trade)";

    let billContent: ReturnType<typeof buildCustomerOrderBillContent> | null = null;
    let tableRows: ReturnType<typeof buildCustomerOrderBillContent>["rows"];
    let meta: ReturnType<typeof buildCustomerOrderBillContent>["meta"];
    let columns = groobeyBillColumnsForKind(billKind);
    let total = 0;
    let marginNote: string | undefined;

    let shopMarginPct = 0;
    if (billKind === "merchant" && typeof data.shopId === "string" && data.shopId.trim()) {
      const { data: shopRow, error: shopMarginErr } = await ownerClient
        .from("shops")
        .select("trade_margin_percent")
        .eq("id", data.shopId.trim())
        .maybeSingle();
      if (shopMarginErr) throw new Error(shopMarginErr.message);
      shopMarginPct = clampMarginPercent(Number(shopRow?.trade_margin_percent ?? 0));
    }

    if (data.orderBill) {
      const ob = data.orderBill;
      const orderForTotals: CustomerOrderBillSource = {
        bill_number: billNo ?? null,
        customer_name: ob.customerName,
        order_items: ob.orderItemsText,
        total_amount: ob.totalAmount,
        grocery_subtotal: ob.grocerySubtotal,
        delivery_charge: ob.deliveryCharge,
        merchant_settlement_amount: ob.merchantSettlementAmount,
        trade_margin_percent_applied: ob.tradeMarginPercent,
      };
      const totals = customerOrderBillTotals(orderForTotals, {
        forMerchant: billKind === "merchant",
        shopMarginPercent: shopMarginPct,
      });
      billContent = buildCustomerOrderBillContent({
        kind: billKind,
        billNumber: billNo ?? null,
        shopName: ob.shopName ?? data.shopName,
        orderTakerLabel: data.ownerName,
        dateLabel: data.billDate,
        customerName: ob.customerName,
        customerPhone: ob.customerPhone,
        deliveryAddress: ob.deliveryAddress,
        deliveryDestination: ob.deliveryDestination,
        customerStreetAddress: ob.customerStreetAddress,
        deliveryTimeSlot: ob.deliveryTimeSlot,
        orderItemsText: ob.orderItemsText,
        grocerySubtotal: totals.grocerySubtotal,
        deliveryCharge: totals.deliveryCharge,
        totalRetail: totals.grandRetail,
        totalMerchant: totals.grandTrade,
        appliedGroobeyMarginPercent: totals.marginPct,
        notes: ob.notes,
      });
      tableRows = billContent.rows;
      meta = [
        ...billContent.meta,
        ...(billKind === "merchant" && customerRef ?
          [{ label: "Shop owner email", value: customerRef }]
        : customerRef ?
          [{ label: "Customer email", value: customerRef }]
        : []),
      ];
      total = billContent.totalInr;
      marginNote = billContent.marginNotePdf;
    } else {
      const items = data.items ?? [];
      const lineRate = (item: (typeof items)[number]) =>
        billKind === "customer" ? item.unitPrice : (item.merchantUnitPrice ?? item.unitPrice);
      const lineAmt = (item: (typeof items)[number]) =>
        Math.round(item.quantity * lineRate(item));
      total = items.reduce((sum, item) => sum + lineAmt(item), 0);
      const margin =
        billKind === "merchant" ?
          Math.round(
            items.reduce(
              (s, i) => s + i.quantity * (i.unitPrice - (i.merchantUnitPrice ?? i.unitPrice)),
              0,
            ),
          )
        : 0;
      tableRows = items.map((item) => {
        const itemName = stripPackFromItemName(item.name);
        const { qty, kgs } = resolveBillQtyAndKgs(item.quantity, item.packUnit);
        if (billKind === "merchant") {
          const tradeRate =
            item.merchantUnitPrice != null && item.merchantUnitPrice > 0 ?
              item.merchantUnitPrice
            : tradeUnitFromRetail(item.unitPrice, 0);
          return {
            item: itemName,
            qty,
            kgs,
            retail: formatInrForPdf(item.unitPrice),
            tradeRate: formatInrForPdf(tradeRate),
            amount: formatInrForPdf(Math.round(item.quantity * tradeRate)),
          };
        }
        return {
          item: itemName,
          qty,
          kgs,
          rate: formatInrForPdf(lineRate(item)),
          amount: formatInrForPdf(lineAmt(item)),
        };
      });
      meta =
        billKind === "customer" ?
          [
            ...billIdMetaRowsForKind(billNo, data.billDate, billKind, "Pending"),
            { label: "From", value: GROOBEY_APP_NAME },
            ...(customerRef ? [{ label: "Customer email", value: customerRef }] : []),
          ]
        : [
            ...billIdMetaRowsForKind(billNo, data.billDate, billKind, "Pending"),
            { label: "Shop", value: data.shopName },
            { label: "Shop / staff", value: data.ownerName },
            ...(customerRef ? [{ label: "Shop owner email", value: customerRef }] : []),
          ];
      marginNote =
        billKind === "merchant" ?
          `Groobey margin (retail - trade): ${formatInrForPdf(margin)}`
        : undefined;
    }

    const pdfBytes = await buildGroobeyBillPdfBuffer({
      billTitle: billContent?.billTitle ?? (groobeyBillTitleForKind(billKind, billNo) || title),
      meta,
      columns,
      rows: tableRows,
      totalInr: total,
      billNumber: billNo,
      marginNote,
      billKind,
    });

    const orderCustomerName =
      typeof data.orderBill === "object" &&
      data.orderBill &&
      "customerName" in data.orderBill &&
      typeof (data.orderBill as { customerName?: string }).customerName === "string" ?
        (data.orderBill as { customerName: string }).customerName
      : undefined;

    const { html, text } = buildBillDeliveryEmail({
      shopName: data.shopName,
      billTitle: title,
      billNumber: billNo,
      customerEmail: customerRef,
      customerName: orderCustomerName,
      billKind,
    });
    const billSubject =
      data.subject.trim() ||
      (ownOrderVerified && billKind === "customer" ?
        billNo ?
          `Order confirmed — Bill ${billNo} — ${GROOBEY_APP_NAME}`
        : `Order confirmed — ${GROOBEY_APP_NAME}`
      : billKind === "customer" ?
        billNo ?
          `Bill ${billNo} ΓÇö ${GROOBEY_APP_NAME}`
        : `Bill ΓÇö ${GROOBEY_APP_NAME}`
      : billNo ?
        `Bill ${billNo} from ${data.shopName}`
      : `Bill from ${data.shopName}`);

    const { deliveredTo, requestedTo } = await sendResendEmail(
      {
        to: targetEmail,
        subject: billSubject,
        html,
        text,
        replyTo: senderEmail || undefined,
        attachments: [
          {
            filename: groobeyBillPdfFilename(billNo),
            content: pdfBytes,
          },
        ],
        tags: [
          {
            name: "category",
            value: billKind === "customer" ? "customer-bill" : "settlement-bill",
          },
        ],
      },
      {
        /** Customer bills must reach the typed address ΓÇö never silently redirect to RESEND_REDIRECT_TO. */
        allowTestModeRedirectFallback: billKind !== "customer",
        billIntendedRecipient: billKind === "customer",
      },
    );
    return {
      ok: true as const,
      deliveredTo,
      requestedTo,
      devRedirect: false,
    };
}

export async function getBillEmailDeliveryInfoHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
await getAuthenticatedUser(data.requesterToken);
    const snap = billEmailDeliveryPublicSnapshot();
    const redirectSet = Boolean(getResendRedirectTo());
    return {
      ...snap,
      redirectToSet: redirectSet,
      noteForStaff:
        snap.canReachCustomerInboxes ?
          "Customer bills are sent as a PDF attachment to the email you enter."
        : "Server is still on Resend test mode until RESEND_FROM_EMAIL uses your verified domain. Until then, sending a bill may show an error instead of going to the wrong inbox.",
    };
}

export async function sendWorkConfirmationEmailHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
const user = await getAuthenticatedUser(data.requesterToken);
    const ownerClient = createOwnerScopedClient(data.requesterToken);
    const { data: profile, error } = await ownerClient
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const to = profile?.email?.trim();
    if (!to) return { ok: true, skipped: true };
    await sendResendEmail({
      to,
      subject: data.subject,
      html: `<p>${data.message.replace(/\n/g, "<br/>")}</p>`,
      text: data.message,
    });
    return { ok: true as const };
}

export async function sendPasswordResetEmailHandler(ctx: { data: unknown }) {
const { data } = ctx as { data: Record<string, unknown> };
if (!hasServiceRoleKey()) {
      throw new Error(
        "Password reset email is unavailable: SUPABASE_SERVICE_ROLE_KEY is missing/invalid in .env.",
      );
    }
    const email = data.email.trim().toLowerCase();
    if (!isGroobeyPlatformAdminEmail(email)) {
      return { ok: true as const };
    }
    const redirectTo = data.redirectTo?.trim();
    const fallbackSite =
      trimResendEnv(process.env.SUPABASE_SITE_URL) ||
      trimResendEnv(process.env.VITE_SUPABASE_SITE_URL);
    const finalRedirect = redirectTo || fallbackSite || "http://localhost:8080";

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: finalRedirect },
    });

    // Do not leak whether the account exists.
    if (error || !linkData?.properties?.action_link) {
      return { ok: true as const };
    }

    const actionLink = linkData.properties.action_link;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <h2>Reset your Groobey password</h2>
        <p>We received a request to reset your password.</p>
        <p style="margin:20px 0;">
          <a href="${escapeHtmlText(actionLink)}" style="display:inline-block;background:#1f8f45;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Reset password</a>
        </p>
        <p style="font-size:13px;color:#555;">If you did not request this, you can ignore this email.</p>
      </div>
    `;
    const text = `Reset your Groobey password\n\nOpen this link to reset password:\n${actionLink}\n\nIf you did not request this, ignore this email.`;

    await sendResendEmail({
      to: email,
      subject: "Reset your Groobey password",
      html,
      text,
    });
    return { ok: true as const };
}

const deliveryOrderStatusSchema = z.object({
  requesterToken: z.string().min(10),
  orderId: z.string().uuid(),
  status: z.enum(["packed", "out_for_delivery", "delivered"]),
});

function assertDeliveryStatusTransition(
  current: Database["public"]["Enums"]["order_status"],
  next: Database["public"]["Enums"]["order_status"],
) {
  if (next === "packed" && current !== "confirmed") {
    throw new Error(`Can only mark Packed from Confirmed (current: ${current}).`);
  }
  if (next === "out_for_delivery" && current !== "confirmed" && current !== "packed") {
    throw new Error(`Can only mark Out for delivery from Confirmed or Packed (current: ${current}).`);
  }
  if (next === "delivered" && current !== "packed" && current !== "out_for_delivery") {
    throw new Error(`Can only mark Delivered from Packed or Out for delivery (current: ${current}).`);
  }
}

/** Delivery status updates via service role (bypasses client RLS when assigned correctly). */
export async function markDeliveryOrderStatusHandler(ctx: { data: unknown }) {
  const data = deliveryOrderStatusSchema.parse(ctx.data);
  const session = await loadSessionRolesMerged(data.requesterToken);
  if (!session) throw new Error("Session expired. Please login again.");
  if (!session.combined.includes("employee")) {
    throw new Error("Only delivery staff can update delivery status.");
  }

  if (!hasServiceRoleKey()) {
    throw new Error(
      "Delivery status update requires SUPABASE_SERVICE_ROLE_KEY on the server. Contact platform admin.",
    );
  }

  const { data: order, error: selectError } = await supabaseAdmin
    .from("customer_orders")
    .select("id,status,assigned_delivery_user_id")
    .eq("id", data.orderId)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (!order) {
    throw new Error(
      "Order not found. Ask Platform Admin to assign this order to you in Sales → Order taker bills.",
    );
  }
  if (order.assigned_delivery_user_id !== session.user.id) {
    throw new Error(
      "Order not assigned to you. Ask Platform Admin to assign this order in Sales → Order taker bills.",
    );
  }

  assertDeliveryStatusTransition(order.status, data.status);

  const { error: updateError } = await supabaseAdmin
    .from("customer_orders")
    .update({ status: data.status })
    .eq("id", data.orderId);

  if (updateError) throw new Error(updateError.message);
  return { ok: true as const };
}

type RegisterCustomerInput = {
  displayName: string;
  email: string;
  phone: string;
  defaultAddress: string;
  password: string;
};

async function registerCustomerViaSignUp(data: RegisterCustomerInput) {
  const url = getSupabaseUrl();
  const key = getPublishableKey();
  if (!url || !key) {
    throw new Error(
      "Customer registration is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env, or add SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const emailTrimmed = data.email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(data.phone);
  if (!normalizedPhone) {
    throw new Error("Enter a valid mobile number.");
  }

  const anonClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
    email: emailTrimmed,
    password: data.password,
    options: {
      data: {
        display_name: data.displayName,
        role: "customer",
        default_address: data.defaultAddress.trim(),
        phone: normalizedPhone,
      },
    },
  });

  if (signUpError) {
    const msg = signUpError.message || "Unable to create account.";
    if (/already|registered|exists/i.test(msg)) {
      throw new Error("This email or mobile is already registered. Try logging in instead.");
    }
    throw new Error(msg);
  }

  if (signUpData.user && (signUpData.user.identities ?? []).length === 0) {
    throw new Error("This email is already registered. Try logging in instead.");
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    throw new Error("Unable to create account. Try again or contact support.");
  }

  const session = signUpData.session;
  if (!session?.access_token) {
    return {
      ok: true as const,
      userId,
      needsEmailConfirmation: true as const,
    };
  }

  const authedClient = createClient<Database>(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error: rpcError } = await authedClient.rpc("register_customer_self", {
    p_display_name: data.displayName,
    p_email: emailTrimmed,
    p_phone: normalizedPhone,
    p_default_address: data.defaultAddress.trim(),
  });

  if (rpcError) {
    if (/register_customer_self|schema cache|could not find the function/i.test(rpcError.message)) {
      throw new Error(
        "Customer registration database setup is pending. Apply the latest Supabase migration (register_customer_self) or set SUPABASE_SERVICE_ROLE_KEY in .env.",
      );
    }
    throw new Error(rpcError.message);
  }

  return { ok: true as const, userId, needsEmailConfirmation: false as const };
}

async function registerCustomerWithServiceRole(data: RegisterCustomerInput) {
  const emailTrimmed = data.email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(data.phone);
  if (!normalizedPhone) {
    throw new Error("Enter a valid mobile number.");
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: emailTrimmed,
    phone: normalizedPhone,
    password: data.password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      display_name: data.displayName,
      role: "customer",
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message || "Unable to create account.";
    if (/already|registered|exists/i.test(msg)) {
      throw new Error("This email or mobile is already registered. Try logging in instead.");
    }
    throw new Error(msg);
  }

  const userId = authData.user.id;
  try {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: userId,
        display_name: data.displayName,
        email: emailTrimmed,
        phone: normalizedPhone,
        default_address: data.defaultAddress.trim(),
        is_active: true,
      } as never,
      { onConflict: "user_id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "customer" } as never,
      { onConflict: "user_id,role" },
    );
    if (roleError) throw new Error(roleError.message);

    const { ensureProfileShopSlug } = await import("@/lib/groobey-profile-slug.server");
    await applyPendingStaffRolesForUser(authData.user, data.displayName);
    await bootstrapAllowlistedRolesForUser(authData.user, ["customer"], "customer");
    await ensureProfileShopSlug(userId, data.displayName, emailTrimmed);
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(e instanceof Error ? e.message : "Unable to save customer profile.");
  }

  return { ok: true as const, userId, needsEmailConfirmation: false as const };
}

/** Public customer registration (no staff portal). */
export async function registerCustomerAccountHandler(ctx: { data: unknown }) {
  const { registerCustomerSchema } = await import("@/lib/tldGroobey.functions-schemas");
  const data = registerCustomerSchema.parse(ctx.data);

  if (hasServiceRoleKey()) {
    return registerCustomerWithServiceRole(data);
  }

  return registerCustomerViaSignUp(data);
}

export async function getShopCombosSchemaStatusHandler() {
  const ready = await shopCombosTableExists();
  return { ready, hasDbPassword: Boolean(readDbPasswordForStatus()) };
}

function readDbPasswordForStatus(): string {
  return (
    process.env.SUPABASE_DB_PASSWORD?.trim() ||
    process.env.POSTGRES_PASSWORD?.trim() ||
    process.env.DATABASE_PASSWORD?.trim() ||
    ""
  );
}

export async function ensureShopCombosSchemaHandler(ctx: { data: unknown }) {
  const { requesterTokenSchema } = await import("@/lib/tldGroobey.functions-schemas");
  const data = requesterTokenSchema.parse(ctx.data);
  await assertAdminOrMain(data.requesterToken);

  if (await shopCombosTableExists()) {
    return { ok: true as const, alreadyReady: true as const };
  }

  const result = await applyShopCombosSchema();
  if (!result.ok) {
    throw new Error(result.message);
  }

  const ready = await shopCombosTableExists();
  if (!ready) {
    throw new Error(
      "Schema SQL ran but shop_combos is not visible yet. Wait a few seconds and refresh, or reload the Supabase API schema cache from Project Settings → API.",
    );
  }

  return { ok: true as const, alreadyReady: false as const };
}

export async function getProductsOutOfStockSchemaStatusHandler() {
  const ready = await productsOutOfStockColumnExists();
  return { ready, hasDbPassword: Boolean(readDbPasswordForStatus()) };
}

export async function ensureProductsOutOfStockSchemaHandler(ctx: { data: unknown }) {
  const { requesterTokenSchema } = await import("@/lib/tldGroobey.functions-schemas");
  const data = requesterTokenSchema.parse(ctx.data);
  await assertAdminOrMain(data.requesterToken);

  if (await productsOutOfStockColumnExists()) {
    return { ok: true as const, alreadyReady: true as const };
  }

  const result = await applyProductsOutOfStockSchema();
  if (!result.ok) {
    throw new Error(result.message);
  }

  const ready = await productsOutOfStockColumnExists();
  if (!ready) {
    throw new Error(
      "Out-of-stock column setup ran but is not visible yet. Wait a few seconds and refresh, or reload the Supabase API schema cache from Project Settings → API.",
    );
  }

  return { ok: true as const, alreadyReady: false as const };
}
