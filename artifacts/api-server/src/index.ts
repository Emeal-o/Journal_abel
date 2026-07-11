import app from "./app.js";
import { logger } from "./lib/logger.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent startup migration: ensures tables managed outside drizzle-kit
 * (sessions, login_events) exist before the server starts accepting traffic.
 * Safe to run on every boot — uses CREATE TABLE/INDEX IF NOT EXISTS.
 */
async function runStartupMigrations() {
  // sessions table — managed by connect-pg-simple, not tracked in Drizzle schema.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      sid    VARCHAR NOT NULL COLLATE "default",
      sess   JSON    NOT NULL,
      expire TIMESTAMP(6) NOT NULL,
      CONSTRAINT sessions_pkey PRIMARY KEY (sid)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)
  `);
  // login_events table — for auth attempt logging.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS login_events (
      id         SERIAL  PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ip_address TEXT    NOT NULL,
      success    BOOLEAN NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_login_events_created_at
      ON login_events(created_at DESC)
  `);
  // Archive columns on weeks — idempotent; existing rows default to NULL (active).
  await db.execute(sql`ALTER TABLE weeks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE weeks ADD COLUMN IF NOT EXISTS month_label TEXT`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_weeks_archived
      ON weeks(user_id, archived_at)
      WHERE archived_at IS NOT NULL
  `);

  // Absolute, never-resetting per-user sequence number assigned at archive
  // time — replaces "count distinct month_label" as the source of truth for
  // ordering/grouping/rollover (see label-utils.ts). Idempotent: only ever
  // fills rows where month_index IS NULL.
  await db.execute(sql`ALTER TABLE weeks ADD COLUMN IF NOT EXISTS month_index INTEGER`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_weeks_month_index
      ON weeks(user_id, month_index)
      WHERE month_index IS NOT NULL
  `);

  // Backfill: for already-archived weeks with no month_index yet, group by
  // (user_id, month_label), order each user's groups chronologically by the
  // earliest created_at in the group, and assign sequential integers 1, 2, 3...
  const backfilled = await db.execute(sql`
    WITH grouped AS (
      SELECT user_id, month_label, MIN(created_at) AS first_created
      FROM weeks
      WHERE archived_at IS NOT NULL AND month_label IS NOT NULL
      GROUP BY user_id, month_label
    ),
    ranked AS (
      SELECT user_id, month_label,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY first_created ASC) AS idx
      FROM grouped
    )
    UPDATE weeks w
    SET month_index = ranked.idx
    FROM ranked
    WHERE w.user_id = ranked.user_id
      AND w.month_label = ranked.month_label
      AND w.archived_at IS NOT NULL
      AND w.month_index IS NULL
    RETURNING w.user_id, w.month_label, w.month_index
  `);
  if (backfilled.length > 0) {
    const distinctMapping = Array.from(
      new Map(
        backfilled.map((r: any) => [`${r.user_id}:${r.month_label}`, r]),
      ).values(),
    );
    logger.info(
      { mapping: distinctMapping.map((r: any) => ({ userId: r.user_id, monthLabel: r.month_label, monthIndex: r.month_index })) },
      "Backfilled month_index for archived weeks.",
    );
  }

  logger.info("Startup migrations complete.");
}

/**
 * Retries runStartupMigrations with exponential backoff. On Replit, the DB
 * proxy can take a moment to become reachable after the process starts, so
 * the first attempt or two may fail with ENOTFOUND/ECONNREFUSED — that's
 * expected and not fatal. If every attempt fails, the caller treats this as
 * a hard startup failure rather than serving traffic against a DB that may
 * be missing required tables.
 */
async function runStartupMigrationsWithRetry(maxAttempts = 6): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runStartupMigrations();
      return;
    } catch (err) {
      lastErr = err;
      const delayMs = Math.min(500 * 2 ** (attempt - 1), 8000);
      logger.warn(
        { err, attempt, maxAttempts, delayMs },
        "Startup migration attempt failed, retrying...",
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure required tables exist *before* accepting any traffic — serving
// requests while `sessions`/`login_events` might not exist yet would let
// early auth/admin requests race the migration and fail intermittently.
runStartupMigrationsWithRetry()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((migrateErr) => {
    logger.error(
      { err: migrateErr },
      "Startup migrations failed after retries — refusing to start.",
    );
    process.exit(1);
  });
