/**
 * Thin fetch wrappers for the authenticated user's profile endpoints.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function profileFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
  });
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

export interface Profile {
  id: number;
  nickname: string | null;
}

export const PROFILE_QUERY_KEY = ["profile"] as const;

export async function getProfile(): Promise<Profile> {
  const res = await profileFetch("/api/profile");
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load profile."));
  }
  return res.json() as Promise<Profile>;
}

export async function updateProfile(nickname: string): Promise<Profile> {
  const res = await profileFetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to save nickname."));
  }
  return res.json() as Promise<Profile>;
}