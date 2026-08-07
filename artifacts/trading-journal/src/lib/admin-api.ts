/**
 * Thin fetch wrappers for the admin endpoints. Mirrors auth-api.ts.
 * Admin auth is a separate session flag from regular user auth — a browser
 * can be logged in as a user, an admin, both, or neither at once.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
  });
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

export interface AdminUser {
  id: number;
  createdAt: string;
  tradeCount: number;
  weekCount: number;
  lastActivity: string | null;
}

export interface LoginEvent {
  id: number;
  userId: number | null;
  ipAddress: string;
  success: boolean;
  createdAt: string;
}

export interface SetupTypeChangeLogEntry {
  id: number;
  userId: number;
  tradeId: number;
  tradeNumber: number;
  weekLabel: string;
  oldSetupTypeId: number | null;
  oldName: string | null;
  newSetupTypeId: number | null;
  newName: string | null;
  changedAt: string;
}

export interface AdminTrade {
  id: number;
  tradeNumber: number;
  result: string;
  setupTypeId: number | null;
  setupTypeName: string | null;
  weekId: number;
  weekLabel: string;
  archivedAt: string | null;
}

export interface AdminSetupType {
  id: number;
  name: string;
  color: string;
  active: boolean;
}


/** True if the browser currently holds a valid admin session. */
export async function getAdminSession(): Promise<boolean> {
  const res = await adminFetch("/api/admin/me");
  return res.ok;
}

/** Verifies the admin password and sets the admin session cookie. Throws on failure. */
export async function adminLogin(password: string): Promise<void> {
  const res = await adminFetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.status === 429) {
    throw new Error("Too many attempts. Please wait 15 minutes before trying again.");
  }
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Invalid password."));
  }
}

/** Clears the admin session flag. */
export async function adminLogout(): Promise<void> {
  await adminFetch("/api/admin/logout", { method: "POST" });
}

/** Lists every user with id, creation date, and activity counts. */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const res = await adminFetch("/api/admin/users");
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load users."));
  }
  return res.json() as Promise<AdminUser[]>;
}

/** Creates a new user and returns their plaintext access code (shown once). */
export async function createAdminUser(): Promise<AdminUser & { code: string }> {
  const res = await adminFetch("/api/admin/users", { method: "POST" });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to create user."));
  }
  return res.json() as Promise<AdminUser & { code: string }>;
}

/** Revokes a user's current code and returns their new plaintext code (shown once). */
export async function revokeAdminUser(id: number): Promise<{ id: number; code: string }> {
  const res = await adminFetch(`/api/admin/users/${id}/revoke`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to revoke access code."));
  }
  return res.json() as Promise<{ id: number; code: string }>;
}

/** Returns the 50 most recent login attempts, newest first. */
export async function listAdminLoginEvents(): Promise<LoginEvent[]> {
  const res = await adminFetch("/api/admin/login-events");
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load login events."));
  }
  return res.json() as Promise<LoginEvent[]>;
}

/** Returns the 100 most recent setup type reassignments, newest first. */
export async function listSetupTypeChangeLog(): Promise<SetupTypeChangeLogEntry[]> {
  const res = await adminFetch("/api/admin/setup-type-change-log");
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load setup type change log."));
  }
  return res.json() as Promise<SetupTypeChangeLogEntry[]>;
}

/** Returns all trades for a user, with week label and current setup type name. */
export async function listAdminUserTrades(userId: number): Promise<AdminTrade[]> {
  const res = await adminFetch(`/api/admin/users/${userId}/trades`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load trades."));
  }
  return res.json() as Promise<AdminTrade[]>;
}

/** Returns all setup types (active and inactive) for a user. */
export async function listAdminUserSetupTypes(userId: number): Promise<AdminSetupType[]> {
  const res = await adminFetch(`/api/admin/users/${userId}/setup-types`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load setup types."));
  }
  return res.json() as Promise<AdminSetupType[]>;
}

/** Reassigns the setup type on a trade (admin-only). Pass null to clear. */
export async function adminUpdateTradeSetupType(
  tradeId: number,
  newSetupTypeId: number | null,
): Promise<void> {
  const res = await adminFetch(`/api/admin/trades/${tradeId}/setup-type`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newSetupTypeId }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to update setup type."));
  }
}
