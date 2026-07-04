# TradeOps — Trading Journal & Stats Dashboard

A premium dark-mode trading journal for logging, tracking, and analyzing trades. Features glassmorphic UI, week-based trade grouping, automated stats, and a PNG screenshot export.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies)
- `pnpm --filter @workspace/trading-journal run dev` — run the frontend (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS (dark glassmorphic theme), wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Screenshot export: html2canvas

## Where things live

- DB schema: `lib/db/src/schema/` (weeks.ts, trades.ts)
- API contract: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/`
- Generated Zod schemas: `lib/api-zod/src/generated/`
- API routes: `artifacts/api-server/src/routes/` (weeks.ts, trades.ts, stats.ts)
- Frontend pages: `artifacts/trading-journal/src/pages/` (journal.tsx, stats.tsx)
- Frontend components: `artifacts/trading-journal/src/components/`

## Architecture decisions

- Weeks are fetched as `Week[]` from `useListWeeks()`; each `WeekCard` fetches its own trades via `useListTrades({ weekId })` for independent loading and cache granularity.
- Stats are computed server-side in `/api/stats/summary` and `/api/stats/weekly` so the frontend only needs to display results.
- Trade number is auto-incremented per week on the server side at creation time.
- `html2canvas` captures the stats section as a PNG on "Download Statistics Card" click.
- Dark mode is forced always via `document.documentElement.classList.add("dark")` in App.tsx.

## Product

- **Journal page (`/`)**: Collapsible week sections, trade table per week (Trade #, Result, RRR, Pips, Notes), add/edit/delete trades and weeks, per-week aggregate stats footer.
- **Stats page (`/stats`)**: Grand total summary (win rate, net RR, net pips, trade count), weekly breakdown table, "Download Statistics Card" PNG export button.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run codegen after editing `lib/api-spec/openapi.yaml`.
- Body schema names in the OpenAPI spec must be entity-shaped (e.g. `TradeInput`), not operation-shaped (e.g. `CreateTradeBody`) to avoid TS2308 collisions in the generated barrel.
- `useListTrades` takes `params` as the first arg, then React Query options as second — the `weekId` filter goes in `params`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
