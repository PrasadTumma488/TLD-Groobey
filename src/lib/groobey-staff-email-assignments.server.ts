import type { User } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ASSIGNABLE_STAFF_ROLES = new Set<AppRole>(["employee", "order_taker", "merchant"]);

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = normalizeStaffEmail(email);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.user_id ?? null;
}

/** Store a pending staff role until the person registers at /signup with this email. */
export async function upsertStaffEmailAssignment(input: {
  email: string;
  role: AppRole;
  displayName?: string;
  assignedBy?: string;
}) {
  if (!ASSIGNABLE_STAFF_ROLES.has(input.role)) {
    throw new Error("Only delivery, order taker, or shop owner roles can be assigned by email.");
  }
  const email = normalizeStaffEmail(input.email);
  const { error } = await supabaseAdmin.from("staff_email_assignments").upsert(
    {
      email,
      role: input.role,
      display_name: input.displayName?.trim() || null,
      assigned_by: input.assignedBy ?? null,
    } as never,
    { onConflict: "email" },
  );
  if (error) throw new Error(error.message);
  return { email, role: input.role };
}

/** Apply pending assignments and optional direct role for an existing profile. */
export async function applyPendingStaffRolesForUser(
  user: Pick<User, "id" | "email">,
  fallbackDisplayName?: string,
): Promise<AppRole[]> {
  const email = user.email?.trim();
  if (!email) return [];

  const normalized = normalizeStaffEmail(email);
  const { data: assignments, error } = await supabaseAdmin
    .from("staff_email_assignments")
    .select("role, display_name")
    .eq("email", normalized);
  if (error) throw new Error(error.message);
  if (!assignments?.length) return [];

  const applied = new Set<AppRole>();
  for (const row of assignments) {
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role: row.role } as never,
      { onConflict: "user_id,role" },
    );
    if (roleError && !/duplicate|already exists|unique constraint/i.test(roleError.message)) {
      throw new Error(roleError.message);
    }
    applied.add(row.role);

    const name = row.display_name?.trim() || fallbackDisplayName?.trim();
    if (name) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof?.display_name?.trim()) {
        await supabaseAdmin
          .from("profiles")
          .update({ display_name: name } as never)
          .eq("user_id", user.id);
      }
    }
  }

  await supabaseAdmin.from("staff_email_assignments").delete().eq("email", normalized);
  return [...applied];
}

export async function listPendingStaffEmailAssignments(): Promise<
  Array<{
    email: string;
    role: AppRole;
    displayName: string | null;
    createdAt: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("staff_email_assignments")
    .select("email, role, display_name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}
