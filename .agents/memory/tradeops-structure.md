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

## Archive feature (Start New Month)
- `weeks` table has two nullable columns: `archived_at TIMESTAMP` and `month_label TEXT`; null = active, non-null = archived
- `GET /api/weeks` returns only active weeks (archived_at IS NULL) by default; `?archived=true` returns archived ones
- `POST /api/weeks/archive-current-month` body `{ monthLabel }` sets archived_at + month_label on all user's active weeks
- Frontend: Journal page shows "Start New Month" button only when active weeks > 0; on click fetches archived list to auto-suggest "Month N+1", opens Dialog for label edit, then POSTs archive; invalidates both `getListWeeksQueryKey()` and `["archived-weeks"]` query keys
- Archive page at `/archive` groups weeks by monthLabel, most-recent group first; uses `WeekCard` with `readOnly` prop
- `WeekCard` has `readOnly?: boolean` prop — when true hides Add Trade / Edit / Delete actions
- Stats routes unchanged — they query all weeks/trades regardless of archived_at, so All-Time stats include archived data

## Replit DATABASE_URL vs PGHOST pitfall
If a user-supplied `DATABASE_URL` secret contains a stale/unreachable internal hostname (symptom: `getaddrinfo ENOTFOUND eppostgresql` or similar), prefer building the connection from the individual `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` runtime env vars instead — those are kept in sync by Replit even when `DATABASE_URL` is stale. Apply this to every driver in use (both `pg.Pool` and `postgres.js`), and gate SSL on `PGSSLMODE` rather than hardcoding it, since Replit's internal Postgres has no TLS but external PGHOST-based DBs might.

## Startup migrations for tables outside drizzle-kit
`drizzle-kit push` can hang non-interactively in the Replit shell against this project's DB. For tables managed outside Drizzle (e.g. `connect-pg-simple`'s `sessions` table), create them with idempotent `CREATE TABLE/INDEX IF NOT EXISTS` at server startup, retried with backoff, and gate `app.listen` on migrations succeeding — don't run migrations fire-and-forget after the port opens, since early requests can race a not-yet-created table and connect-pg-simple's `sessions` table specifically doesn't tolerate a `DEFERRABLE` primary key (breaks its `ON CONFLICT` upsert).
