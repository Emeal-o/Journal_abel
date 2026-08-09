import app from "./app.js";
import { logger } from "./lib/logger.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent startup migration: ensures tables managed outside drizzle-kit
 * (sessions, login_events, app_settings) exist before the server starts
 * accepting traffic.
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
  // app_settings — the single public About configuration row.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id           INTEGER PRIMARY KEY,
      version      TEXT NOT NULL,
      tagline      TEXT NOT NULL,
      description  TEXT NOT NULL,
      honesty_note TEXT NOT NULL,
      bug_report_email TEXT NOT NULL,
      credit_line TEXT,
      updated_at   TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  // Stage 3: add the admin-editable bug-report destination to existing installs.
  await db.execute(sql`
    ALTER TABLE app_settings
      ADD COLUMN IF NOT EXISTS bug_report_email TEXT
  `);
  await db.execute(sql`
    UPDATE app_settings
    SET bug_report_email = 'tradeops37@gmail.com'
    WHERE id = 1 AND bug_report_email IS NULL
  `);
  // Optional admin-editable credit line; existing installs default to NULL.
  await db.execute(sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS credit_line TEXT`);
  await db.execute(sql`
    INSERT INTO app_settings (id, version, tagline, description, honesty_note, bug_report_email)
    VALUES (
      1,
      '1.4',
      'A private trading journal for logging, reviewing, and analyzing your trades over time.',
      'Track weekly performance, break down results by setup and direction, and see your long-term stats — win rate, R:R, drawdown, and more.',
      'This journal only works if it''s honest — every entry relies on you logging your real trades.',
      'tradeops37@gmail.com'
    )
    ON CONFLICT (id) DO NOTHING
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
  // Optional self-service profile nickname; NULL means not set.
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT`);
  // Optional emoji flag on trades — idempotent; existing rows default to NULL (no flag).
  await db.execute(sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS flag_emoji TEXT`);

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

  // setup_types table — for tagging trades with a named setup type.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS setup_types (
      id         SERIAL  PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL,
      active     BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT setup_types_user_id_name_key UNIQUE (user_id, name)
    )
  `);
  // setup_type_id on trades — nullable FK, preserved on soft-delete.
  await db.execute(sql`
    ALTER TABLE trades
      ADD COLUMN IF NOT EXISTS setup_type_id INTEGER
        REFERENCES setup_types(id) ON DELETE SET NULL
  `);
  // Optional description on setup_types — idempotent; existing rows default to NULL.
  await db.execute(sql`ALTER TABLE setup_types ADD COLUMN IF NOT EXISTS description TEXT`);

  // Direction on trades — "Long" | "Short" | null (null for legacy trades pre-dating this field).
  await db.execute(sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS direction TEXT`);

  // setup_type_change_log — audit trail for admin setup-type reassignments.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS setup_type_change_log (
      id                SERIAL  PRIMARY KEY,
      trade_id          INTEGER REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
      user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      old_setup_type_id INTEGER REFERENCES setup_types(id) ON DELETE SET NULL,
      new_setup_type_id INTEGER REFERENCES setup_types(id) ON DELETE SET NULL,
      changed_at        TIMESTAMP DEFAULT NOW() NOT NULL
    )
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
