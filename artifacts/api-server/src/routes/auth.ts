import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { db, usersTable, loginEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * Rate limiter: max 5 login attempts per IP per 15-minute window.
 * Prevents brute-force guessing of access codes.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Generate a cryptographically random alphanumeric access code.
 * Returns a 12-character uppercase string (62^12 ≈ 3.2 × 10^21 possibilities).
 */
export function generateAccessCode(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length * 2); // oversample to avoid modulo bias
  let code = "";
  for (let i = 0; i < bytes.length && code.length < length; i++) {
    const idx = bytes[i]! % chars.length;
    // Reject values above the largest multiple of chars.length to eliminate bias
    if (bytes[i]! < Math.floor(256 / chars.length) * chars.length) {
      code += chars[idx];
    }
  }
  // Pad if we ran out of bytes (extremely unlikely) — recurse to get more
  if (code.length < length) {
    code += generateAccessCode(length - code.length);
  }
  return code;
}

/**
 * Hash an access code with bcrypt (cost factor 12).
 */
export async function hashAccessCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

/**
 * Extract the real client IP, preferring the x-forwarded-for header set by
 * Vercel's / Replit's proxy over Express's req.ip (which resolves to the
 * proxy's address when trust proxy is set).
 */
function getClientIp(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? "unknown";
}

function parseOsAndBrowser(userAgent: string | undefined): string {
  const ua = userAgent ?? "";
  const os = /Windows NT/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : "Unknown OS";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /OPR\//i.test(ua) ? "Opera"
    : /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? "Safari"
    : /MSIE|Trident\//i.test(ua) ? "Internet Explorer"
    : "Unknown browser";
  return `${os} · ${browser}`;
}

async function lookupIpLocation(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown" || /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$)/.test(ip)) return null;

  // ipapi.co is the preferred provider, but its free endpoint can return
  // 429s from shared/serverless IPs. Keep a no-key fallback so login
  // telemetry remains useful without making authentication depend on either
  // provider being available.
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const data = await response.json() as { city?: string; country_name?: string };
      const location = [data.city, data.country_name].filter(Boolean).join(", ");
      if (location) return location;
    } else {
      logger.warn({ status: response.status, ip }, "Primary IP geolocation lookup failed");
    }
  } catch (error) {
    logger.warn({ error, ip }, "Primary IP geolocation lookup timed out or failed");
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      logger.warn({ status: response.status, ip }, "Fallback IP geolocation lookup failed");
      return null;
    }
    const data = await response.json() as { success?: boolean; city?: string; country?: string };
    if (!data.success) return null;
    const location = [data.city, data.country].filter(Boolean).join(", ");
    return location || null;
  } catch (error) {
    logger.warn({ error, ip }, "Fallback IP geolocation lookup timed out or failed");
    return null;
  }
}

function maskAccessCode(code: string): string {
  return code.length > 4 ? `••••••••${code.slice(-4)}` : "••••";
}

// POST /api/auth/login
// Verifies the submitted access code against stored hashes.
// On success, sets a session cookie with the user's ID.
router.post("/auth/login", loginLimiter, async (req, res) => {
  const { code, browserTimezone, screenResolution } = req.body as {
    code?: string;
    browserTimezone?: string;
    screenResolution?: string;
  };

  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Access code is required." });
    return;
  }

  const trimmed = code.trim().toUpperCase();

  // Fetch all user hashes and compare using bcrypt's constant-time comparison.
  // The number of users is expected to be very small (personal journal).
  const users = await db.select().from(usersTable);

  let matchedUser: typeof users[0] | null = null;
  for (const user of users) {
    const match = await bcrypt.compare(trimmed, user.codeHash);
    if (match) {
      matchedUser = user;
      break;
    }
  }

  // Log the attempt (success or failure) regardless of outcome.
  // Fire-and-forget: a logging failure should not block the auth response.
  const ip = getClientIp(req);
  const ipLocation = await lookupIpLocation(ip);
  db.insert(loginEventsTable).values({
    userId: matchedUser?.id ?? null,
    ipAddress: ip,
    ipLocation,
    browserTimezone: typeof browserTimezone === "string" ? browserTimezone.slice(0, 100) : null,
    screenResolution: typeof screenResolution === "string" ? screenResolution.slice(0, 40) : null,
    osAndBrowser: parseOsAndBrowser(req.get("user-agent")),
    accessCodeUsed: maskAccessCode(trimmed),
    success: matchedUser !== null,
  }).catch(() => { /* non-critical */ });

  if (!matchedUser) {
    res.status(401).json({ error: "Invalid access code." });
    return;
  }

  // Regenerate session ID to prevent session fixation attacks
  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Session error." });
      return;
    }
    req.session.userId = matchedUser!.id;
    res.json({ ok: true, userId: matchedUser!.id });
  });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ ok: true });
  });
});

// GET /api/auth/me — check current session
router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  const [user] = await db.select({ hideCreditLine: usersTable.hideCreditLine })
    .from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  res.json({ userId: req.session.userId, hideCreditLine: user.hideCreditLine });
});

export default router;
