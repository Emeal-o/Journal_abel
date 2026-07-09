import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error(
    "DATABASE_URL (or PG* env vars) must be set. Did you forget to provision a database?",
  );
}

/**
 * Resolves the SSL mode for PGHOST-based connections from PGSSLMODE, so
 * TLS-requiring deployments (e.g. an external PGHOST behind a managed DB)
 * aren't silently downgraded to plaintext. Replit's own internal Postgres
 * does not use TLS, so the default (no PGSSLMODE set) is `false`.
 */
type PgSslMode = "disable" | "require" | "verify-ca" | "verify-full" | "prefer" | "allow" | undefined;

function wantsTls(mode: PgSslMode): boolean {
  return mode === "require" || mode === "verify-ca" || mode === "verify-full" || mode === "prefer" || mode === "allow";
}

/**
 * Build connection options for postgres.js, preferring the individual
 * PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD runtime vars over DATABASE_URL.
 * Replit sets these to the correct internal hostname ("helium"), while
 * DATABASE_URL may contain a stale or unreachable alias. When PGHOST is not
 * set, DATABASE_URL is used directly (e.g. an external Neon connection
 * string), with prepare:false for Neon's pooled/PgBouncer compatibility.
 */
function createQueryClient() {
  const mode = process.env.PGSSLMODE as PgSslMode;
  if (process.env.PGHOST) {
    return postgres({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      prepare: false,
      ssl: wantsTls(mode) ? (mode === "prefer" || mode === "allow" ? "prefer" : "require") : false,
    });
  }
  // Neon / external DATABASE_URL path — prepare:false required for pooled
  // connection strings (PgBouncer in transaction mode) which don't support
  // server-side prepared statements.
  return postgres(process.env.DATABASE_URL!, { prepare: false });
}

/**
 * pg.Pool for connect-pg-simple (session store) and admin raw SQL.
 * Prefer PGHOST-based config over DATABASE_URL for the same reason above.
 */
function buildPgPoolConfig(): pg.PoolConfig {
  const mode = process.env.PGSSLMODE as PgSslMode;
  if (process.env.PGHOST) {
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: wantsTls(mode) ? { rejectUnauthorized: mode === "verify-full" || mode === "verify-ca" } : false,
    };
  }
  return { connectionString: process.env.DATABASE_URL };
}

// pg.Pool is kept for connect-pg-simple (session store) and admin raw SQL.
export const pool = new Pool(buildPgPoolConfig());

// postgres.js with prepare: false for Drizzle — required for Neon's pooled
// connection string (PgBouncer in transaction mode), which does not support
// server-side prepared statements.
export const db = drizzle(createQueryClient(), { schema });

export * from "./schema";
