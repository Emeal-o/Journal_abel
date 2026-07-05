# TradeOps — Trading Journal

A trading journal app for logging weekly sessions and analyzing performance.

## Architecture

pnpm monorepo with three artifacts:

| Artifact | Path | Preview |
|---|---|---|
| Frontend (React + Vite) | `artifacts/trading-journal` | `/` |
| API Server (Express) | `artifacts/api-server` | `/api` |
| Mockup Sandbox | `artifacts/mockup-sandbox` | `/__mockup` |

Shared libraries in `lib/`:
- `lib/db` — Drizzle ORM schema + Postgres client (`DATABASE_URL`)
- `lib/api-zod` — shared Zod validation schemas
- `lib/api-client-react` — TanStack Query hooks for the frontend

## Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, Radix UI, Framer Motion, Wouter
- **Backend**: Node.js, Express 5, Drizzle ORM, Zod, Pino
- **Database**: PostgreSQL (Replit managed, `DATABASE_URL` auto-provisioned)

## Running in dev mode

All three workflows start automatically. To restart manually:

```bash
# Install dependencies (first time)
pnpm install

# Push DB schema
pnpm --filter @workspace/db run push

# Start individual services
pnpm --filter @workspace/trading-journal run dev   # frontend
pnpm --filter @workspace/api-server run dev        # API server
```

## Environment variables

- `DATABASE_URL` — auto-provided by Replit
- `SESSION_SECRET` — set in Replit Secrets

## User preferences

_(none recorded yet)_
