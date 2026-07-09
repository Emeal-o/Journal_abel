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
