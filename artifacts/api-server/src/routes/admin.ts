import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import crypto from "node:crypto";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  db, pool,
  usersTable, tradesTable, weeksTable, loginEventsTable,
  setupTypesTable, setupTypeChangeLogTable,
} from "@workspace/db";
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
// Lists every user's id, creation date, and per-user activity counts
// (trade count, week count, most recent activity timestamp).
// All counts are computed in a single query to avoid N+1 queries.
router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      nickname: usersTable.nickname,
      createdAt: usersTable.createdAt,
      tradeCount: sql<number>`cast(count(distinct ${tradesTable.id}) as int)`,
      weekCount: sql<number>`cast(count(distinct ${weeksTable.id}) as int)`,
      lastActivity: sql<string | null>`GREATEST(MAX(${tradesTable.createdAt}), MAX(${weeksTable.createdAt}))`,
    })
    .from(usersTable)
    .leftJoin(tradesTable, eq(tradesTable.userId, usersTable.id))
    .leftJoin(weeksTable, eq(weeksTable.userId, usersTable.id))
    .groupBy(usersTable.id, usersTable.nickname, usersTable.createdAt)
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

// GET /api/admin/login-events
// Returns the 50 most recent login attempts (successful and failed),
// ordered by newest first.
router.get("/admin/login-events", requireAdmin, async (_req, res) => {
  const events = await db
    .select({
      id: loginEventsTable.id,
      userId: loginEventsTable.userId,
      ipAddress: loginEventsTable.ipAddress,
      ipLocation: loginEventsTable.ipLocation,
      browserTimezone: loginEventsTable.browserTimezone,
      screenResolution: loginEventsTable.screenResolution,
      osAndBrowser: loginEventsTable.osAndBrowser,
      accessCodeUsed: loginEventsTable.accessCodeUsed,
      success: loginEventsTable.success,
      createdAt: loginEventsTable.createdAt,
    })
    .from(loginEventsTable)
    .orderBy(desc(loginEventsTable.createdAt))
    .limit(50);

  res.json(events);
});

// GET /api/admin/setup-type-change-log
// Returns the 100 most recent setup type reassignments made via the admin
// panel, with trade context (week label + trade number) and both type names.
router.get("/admin/setup-type-change-log", requireAdmin, async (_req, res) => {
  // Two left-joins on the same table (old vs new setup type) require a raw
  // SQL query; aliased column names become camelCase keys via postgres.js.
  const rows = await db.execute(sql`
    SELECT
      l.id,
      l.user_id           AS "userId",
      l.trade_id          AS "tradeId",
      l.old_setup_type_id AS "oldSetupTypeId",
      l.new_setup_type_id AS "newSetupTypeId",
      l.changed_at        AS "changedAt",
      t.trade_number      AS "tradeNumber",
      w.label             AS "weekLabel",
      old_st.name         AS "oldName",
      new_st.name         AS "newName"
    FROM setup_type_change_log l
    JOIN   trades      t      ON t.id      = l.trade_id
    JOIN   weeks       w      ON w.id      = t.week_id
    LEFT JOIN setup_types old_st ON old_st.id = l.old_setup_type_id
    LEFT JOIN setup_types new_st ON new_st.id = l.new_setup_type_id
    ORDER BY l.changed_at DESC
    LIMIT 100
  `);
  res.json(Array.from(rows).map((r: any) => ({
    ...r,
    changedAt: r.changedAt instanceof Date ? r.changedAt.toISOString() : r.changedAt,
  })));
});

// GET /api/admin/users/:userId/trades
// Returns all trades for a user, joined with week label and current setup type
// name. Used by the admin reassign UI to browse a user's trades.
router.get("/admin/users/:userId/trades", requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }

  const trades = await db
    .select({
      id: tradesTable.id,
      tradeNumber: tradesTable.tradeNumber,
      result: tradesTable.result,
      setupTypeId: tradesTable.setupTypeId,
      weekId: weeksTable.id,
      weekLabel: weeksTable.label,
      archivedAt: weeksTable.archivedAt,
      setupTypeName: setupTypesTable.name,
    })
    .from(tradesTable)
    .innerJoin(weeksTable, eq(weeksTable.id, tradesTable.weekId))
    .leftJoin(setupTypesTable, eq(setupTypesTable.id, tradesTable.setupTypeId))
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(weeksTable.startDate), tradesTable.tradeNumber);

  res.json(trades.map((t) => ({
    ...t,
    archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
  })));
});

// GET /api/admin/users/:userId/setup-types
// Returns ALL setup types for a user (active and inactive), used to populate
// the reassign dropdown. Inactive types are included so the admin can see the
// full history and reassign to a type that was soft-deleted.
router.get("/admin/users/:userId/setup-types", requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }

  const setupTypes = await db
    .select({
      id: setupTypesTable.id,
      name: setupTypesTable.name,
      color: setupTypesTable.color,
      active: setupTypesTable.active,
    })
    .from(setupTypesTable)
    .where(eq(setupTypesTable.userId, userId))
    .orderBy(setupTypesTable.name);

  res.json(setupTypes);
});

// PATCH /api/admin/trades/:tradeId/setup-type
// Admin-only endpoint to reassign the setup type on any trade (active or
// archived). This is the ONLY field on archived trades that the admin can
// override — all other fields (result, rrr, pips, notes, …) remain locked.
// Records every change in setup_type_change_log for auditability.
router.patch("/admin/trades/:tradeId/setup-type", requireAdmin, async (req, res) => {
  const tradeId = Number(req.params.tradeId);
  if (!Number.isInteger(tradeId) || tradeId < 1) {
    res.status(400).json({ error: "Invalid trade id." });
    return;
  }

  // newSetupTypeId: null = clear the tag; positive integer = set a specific type.
  const { newSetupTypeId: rawNew } = req.body as { newSetupTypeId?: unknown };
  let newSetupTypeId: number | null;
  if (rawNew === null || rawNew === undefined) {
    newSetupTypeId = null;
  } else {
    const parsed = Number(rawNew);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      res.status(400).json({ error: "newSetupTypeId must be a positive integer or null." });
      return;
    }
    newSetupTypeId = parsed;
  }

  // Verify the trade exists and capture its owner + current tag.
  const [trade] = await db
    .select({ id: tradesTable.id, userId: tradesTable.userId, setupTypeId: tradesTable.setupTypeId })
    .from(tradesTable)
    .where(eq(tradesTable.id, tradeId));
  if (!trade) {
    res.status(404).json({ error: "Trade not found." });
    return;
  }

  // When setting a type, it MUST belong to the same user who owns the trade —
  // setup types are per-user and must never be cross-assigned.
  if (newSetupTypeId !== null) {
    const [setupType] = await db
      .select({ id: setupTypesTable.id })
      .from(setupTypesTable)
      .where(and(eq(setupTypesTable.id, newSetupTypeId), eq(setupTypesTable.userId, trade.userId)));
    if (!setupType) {
      res.status(400).json({ error: "Invalid setupTypeId: setup type does not belong to this trade's owner." });
      return;
    }
  }

  const oldSetupTypeId = trade.setupTypeId ?? null;

  // Update only the setupTypeId — no other field is touched.
  await db
    .update(tradesTable)
    .set({ setupTypeId: newSetupTypeId })
    .where(eq(tradesTable.id, tradeId));

  // Audit log — always inserted, even if old === new (idempotent re-runs are
  // visible to the admin and serve as an activity record).
  await db
    .insert(setupTypeChangeLogTable)
    .values({ tradeId, userId: trade.userId, oldSetupTypeId, newSetupTypeId });

  res.json({ ok: true, tradeId, userId: trade.userId, oldSetupTypeId, newSetupTypeId });
});

export default router;
