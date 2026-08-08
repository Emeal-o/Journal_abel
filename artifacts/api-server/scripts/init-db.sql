-- Bootstrap script for a fresh database.
-- Run once on a new Replit-provisioned Postgres instance before starting the server:
--
--   psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER" -f artifacts/api-server/scripts/init-db.sql
--
-- All statements are idempotent (CREATE … IF NOT EXISTS) so re-running is safe.
-- The server's own startup migration handles sessions, login_events, and
-- ALTER TABLE additions — this script only creates the core Drizzle-managed tables
-- that must exist before the startup migration can reference them.

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  code_hash  TEXT   NOT NULL UNIQUE,
  nickname   TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;

CREATE TABLE IF NOT EXISTS weeks (
  id          SERIAL  PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  label       TEXT    NOT NULL,
  start_date  TEXT    NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW() NOT NULL,
  archived_at TIMESTAMP,
  month_label TEXT,
  month_index INTEGER
);

CREATE TABLE IF NOT EXISTS trades (
  id           SERIAL  PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  week_id      INTEGER REFERENCES weeks(id) ON DELETE CASCADE NOT NULL,
  trade_number INTEGER NOT NULL,
  result       TEXT    NOT NULL,
  rrr          REAL    NOT NULL,
  pips         REAL    NOT NULL,
  notes        TEXT,
  flag_emoji   TEXT,
  created_at   TIMESTAMP DEFAULT NOW() NOT NULL
);
