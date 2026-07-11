/**
 * Thin fetch wrappers for archive-related week endpoints.
 * These are NOT generated from the OpenAPI spec because the archive columns
 * (archivedAt, monthLabel) are outside the original spec — keep them here
 * until the spec is regenerated.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function weeksFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
}

export interface ArchivedWeek {
  id: number;
  userId: number;
  label: string;
  startDate: string;
  notes: string | null;
  createdAt: string;
  archivedAt: string;
  monthLabel: string;
}

/** Fetches all archived weeks for the current user (archived_at IS NOT NULL). */
export async function listArchivedWeeks(): Promise<ArchivedWeek[]> {
  const res = await weeksFetch("/api/weeks?archived=true");
  if (!res.ok) throw new Error("Failed to load archived weeks.");
  return res.json() as Promise<ArchivedWeek[]>;
}

/**
 * Archives all of the user's current active weeks under `monthLabel`.
 * Returns the count of weeks that were archived.
 */
export async function archiveCurrentMonth(
  monthLabel: string,
): Promise<{ archivedCount: number }> {
  const res = await weeksFetch("/api/weeks/archive-current-month", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monthLabel }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to archive weeks.");
  }
  return res.json() as Promise<{ archivedCount: number }>;
}
