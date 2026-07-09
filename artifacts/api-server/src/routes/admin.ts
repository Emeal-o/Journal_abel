import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { generateAccessCode, hashAccessCode } from "./auth.js";

const router: IRouter = Router();

if (!process.env.ADMIN_SECRET) {
  throw new Error(
    "ADMIN_SECRET environment variable is required but was not provided. " +
      "Set it to a strong password used to protect the /admin page.",
  );
}

const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Constant-time string comparison. Plain `===` leaks timing information
 * proportional to the number of matching leading bytes, which an attacker
 * can exploit to guess the admin password character-by-character.
 */
function timingSafeStringsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so the early return
    // above doesn't itself leak length information via a timing shortcut.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Rate limiter: max 5 admin login attempts per IP per 15-minute window.
 * Mirrors the user login limiter in auth.ts.
 */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/admin/login
router.post("/admin/login", adminLoginLimiter, async (req, res) => {
  const { password } = req.body as { password?: string };

  if (typeof password !== "string" || password.length === 0) {
    res.status(400).json({ error: "Password is required." });
    return;
  }

  if (!timingSafeStringsEqual(password, ADMIN_SECRET)) {
    res.status(401).json({ error: "Invalid password." });
    return;
  }

  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Session error." });
      return;
    }
    req.session.isAdmin = true;
    res.json({ ok: true });
  });
});

// POST /api/admin/logout
// Only clears the admin flag, not the whole session — the same browser
// could also be separately logged in as a regular journal user (userId),
// and that session shouldn't be torn down just because the admin panel
// was closed.
router.post("/admin/logout", (req, res) => {
  req.session.isAdmin = false;
  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session error." });
      return;
    }
    res.json({ ok: true });
  });
});

// GET /api/admin/me
router.get("/admin/me", (req, res) => {
  if (!req.session.isAdmin) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  res.json({ isAdmin: true });
});

// GET /api/admin/users
// Lists every user's id and creation date. Never exposes code_hash.
router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db
    .select({ id: usersTable.id, createdAt: usersTable.createdAt })
    .from(usersTable)
    .orderBy(usersTable.id);
  res.json(users);
});

// POST /api/admin/users
// Creates a new user with a fresh random access code. The plaintext code is
// returned exactly once in this response — it is never stored or shown again.
router.post("/admin/users", requireAdmin, async (_req, res) => {
  const code = generateAccessCode(12);
  const codeHash = await hashAccessCode(code);
  const [user] = await db.insert(usersTable).values({ codeHash }).returning({
    id: usersTable.id,
    createdAt: usersTable.createdAt,
  });
  res.status(201).json({ id: user!.id, createdAt: user!.createdAt, code });
});

// POST /api/admin/users/:id/revoke
// Overwrites the user's code_hash with a freshly generated code and kills
// every active session for that user, so a leaked/compromised old code
// stops working immediately rather than just on next login. Their
// trades/weeks data is untouched (no cascade — only sessions are deleted).
router.post("/admin/users/:id/revoke", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!existing) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const newCode = generateAccessCode(12);
  const newHash = await hashAccessCode(newCode);

  // Replace the code hash AND destroy active sessions in a single
  // transaction so the two changes become visible atomically — see
  // scripts/revoke-code.ts for the original rationale (same operation,
  // exposed here as an API endpoint instead of a shell script).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE users SET code_hash = $1 WHERE id = $2`, [newHash, userId]);
    await client.query(`DELETE FROM sessions WHERE sess ->> 'userId' = $1`, [String(userId)]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ id: userId, code: newCode });
});

export default router;
