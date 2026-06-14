import { EM_DASH } from "@/lib/groobey-currency";

function parseGroobeyDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Admin UI: `3 Jun 2026, 4:30 PM` (12-hour, en-IN). */
export function formatGroobeyDateTime(value: string | null | undefined) {
  const d = parseGroobeyDate(value);
  if (!d) return value?.trim() || EM_DASH;
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

/** Short date for lists: `3 Jun 2026`. */
export function formatGroobeyDateShort(value: string | null | undefined) {
  const d = parseGroobeyDate(value);
  if (!d) return value?.trim().slice(0, 10) || EM_DASH;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Time only: `4:30 PM`. */
export function formatGroobeyTime(value: string | null | undefined) {
  const d = parseGroobeyDate(value);
  if (!d) return EM_DASH;
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
