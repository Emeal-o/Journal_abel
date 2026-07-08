import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { db, usersTable } from "@workspace/db";

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

// POST /api/auth/login
// Verifies the submitted access code against stored hashes.
// On success, sets a session cookie with the user's ID.
router.post("/auth/login", loginLimiter, async (req, res) => {
  const { code } = req.body as { code?: string };

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
router.get("/auth/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  res.json({ userId: req.session.userId });
});

export default router;
