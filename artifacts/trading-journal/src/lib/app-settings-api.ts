const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

export const APP_SETTINGS_QUERY_KEY = ["app-settings"] as const;

export interface AppSettings {
  id: number;
  version: string;
  tagline: string;
  description: string;
  honesty_note: string;
  bug_report_email: string;
  privacy_policy: string;
  updated_at: string;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

async function appSettingsFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
  });
}

export async function getAppSettings(): Promise<AppSettings> {
  const res = await appSettingsFetch("/api/app-settings");
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load About content."));
  }
  return res.json() as Promise<AppSettings>;
}

export interface AppSettingsInput {
  version: string;
  tagline: string;
  description: string;
  honesty_note: string;
  bug_report_email: string;
  privacy_policy: string;
}

export async function updateAppSettings(input: AppSettingsInput): Promise<AppSettings> {
  const res = await appSettingsFetch("/api/app-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to save About content."));
  }
  return res.json() as Promise<AppSettings>;
}