/**
 * Thin fetch wrappers for the auth endpoints.
 * Respects VITE_API_URL for Vercel deployments; falls back to same-origin relative paths.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include", // always send the session cookie
    ...init,
  });
}

export interface MeResponse {
  userId: number;
}

/** Returns the current user, or null if not authenticated. */
export async function getMe(): Promise<MeResponse | null> {
  const res = await authFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to check session");
  return res.json() as Promise<MeResponse>;
}

/** Verifies the access code and sets the session cookie on success. Throws on failure. */
export async function login(rawCode: string): Promise<MeResponse & { ok: true }> {
  // Normalize here to match the server's own normalization (trim + uppercase)
  const code = rawCode.trim().toUpperCase();
  const res = await authFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.status === 429) {
    throw new Error("Too many attempts. Please wait 15 minutes before trying again.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Invalid access code.");
  }
  return res.json() as Promise<MeResponse & { ok: true }>;
}

/** Clears the server session. */
export async function logout(): Promise<void> {
  await authFetch("/api/auth/logout", { method: "POST" });
}
