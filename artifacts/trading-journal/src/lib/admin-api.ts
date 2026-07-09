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
