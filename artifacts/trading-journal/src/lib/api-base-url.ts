import { Capacitor } from "@capacitor/core";

const PRODUCTION_API_BASE_URL = "https://tradeops-api.vercel.app";
const configuredApiBaseUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

/**
 * Keep browser requests relative so Vercel's /api rewrite remains unchanged.
 * A bundled Capacitor app has no same-origin API proxy, so it must use the
 * production API origin explicitly.
 */
export function getApiBaseUrl(): string {
  return Capacitor.isNativePlatform()
    ? PRODUCTION_API_BASE_URL
    : configuredApiBaseUrl;
}