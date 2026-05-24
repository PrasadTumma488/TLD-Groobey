/** Public-facing staff identity - Groobey code only (never Auth user UUID). */

export function formatStaffBillLabel(params: {
  displayName: string;
  groobeyCode?: string | null;
}): string {
  const name = params.displayName.trim() || "Delivery boy";
  const code = params.groobeyCode?.trim();
  if (code) return `${name} · ${code}`;
  return `${name} · Groobey ID pending`;
}

export function buildGroobeyIdByUserId(
  rows: Array<{ userId: string; groobeyId?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const code = row.groobeyId?.trim();
    if (code) map.set(row.userId, code);
  }
  return map;
}

export function groobeyIdForUser(userId: string, groobeyByUserId: Map<string, string>): string {
  return groobeyByUserId.get(userId)?.trim() || "Groobey ID pending";
}

/** Attendance / lists: name + Groobey ID (no UUID). */
export function formatPersonWithGroobeyId(params: {
  userId: string;
  displayName?: string | null;
  groobeyByUserId: Map<string, string>;
}): string {
  const name = params.displayName?.trim();
  const groobey = groobeyIdForUser(params.userId, params.groobeyByUserId);
  if (name) return `${name} · ${groobey}`;
  return groobey;
}
