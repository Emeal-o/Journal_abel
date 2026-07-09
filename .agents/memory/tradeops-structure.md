---
name: TradeOps app structure
description: Architecture and key decisions for the TradeOps trading journal app ported from Vercel to Replit.
---

# TradeOps — Trading Journal

## Architecture
- pnpm monorepo; frontend at `artifacts/trading-journal/`, backend at `artifacts/api-server/`
- Database: PostgreSQL via Drizzle ORM; tables: `trades`, `weeks` (see `lib/db/src/schema/`)
- API spec: `lib/api-spec/openapi.yaml` — weeks, trades, stats/summary, stats/weekly endpoints
- Generated hooks in `lib/api-client-react/`, Zod schemas in `lib/api-zod/`

## Key decisions
- `vite.config.ts` has `server.fs.strict: false` — required because `@assets` alias points to `attached_assets/` outside artifact root
- App forces dark mode via `document.documentElement.classList.add("dark")` in App.tsx
- API server mounts all routes under `/api` prefix
- Frontend uses wouter with `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` for path-based routing

**Why:** Vercel project was already Vite+React (not Next.js), so migration skipped Next.js conversion; only needed to register artifact, copy src files, update lib sources, and wire workflows.

## Replit DATABASE_URL vs PGHOST pitfall
If a user-supplied `DATABASE_URL` secret contains a stale/unreachable internal hostname (symptom: `getaddrinfo ENOTFOUND eppostgresql` or similar), prefer building the connection from the individual `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` runtime env vars instead — those are kept in sync by Replit even when `DATABASE_URL` is stale. Apply this to every driver in use (both `pg.Pool` and `postgres.js`), and gate SSL on `PGSSLMODE` rather than hardcoding it, since Replit's internal Postgres has no TLS but external PGHOST-based DBs might.

## Startup migrations for tables outside drizzle-kit
`drizzle-kit push` can hang non-interactively in the Replit shell against this project's DB. For tables managed outside Drizzle (e.g. `connect-pg-simple`'s `sessions` table), create them with idempotent `CREATE TABLE/INDEX IF NOT EXISTS` at server startup, retried with backoff, and gate `app.listen` on migrations succeeding — don't run migrations fire-and-forget after the port opens, since early requests can race a not-yet-created table and connect-pg-simple's `sessions` table specifically doesn't tolerate a `DEFERRABLE` primary key (breaks its `ON CONFLICT` upsert).
