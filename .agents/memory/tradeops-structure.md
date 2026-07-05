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
