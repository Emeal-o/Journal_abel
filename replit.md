# TradeOps — Trading Journal

A private trading journal where users track weekly performance and individual trades, protected by personal access codes.

## Run & Operate

Workflows (managed by Replit — restart from the Workflows panel):
- **API Server** — `pnpm --filter @workspace/api-server run dev`
- **Trading Journal (web)** — `pnpm --filter @workspace/trading-journal run dev`

One-off commands:
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, non-interactive)

Required secrets (all set in Replit Secrets):
- `DATABASE_URL` — Postgres connection string (Replit-managed dev database, separate from the production Neon DB used by the Vercel deployment)
- `SESSION_SECRET` — session signing secret
- `ADMIN_SECRET` — password for the /admin panel (create/manage user access codes)

Dev database note: this Repl's `DATABASE_URL` points to a fresh Replit-provisioned Postgres instance, not the production Neon DB. It starts empty — use the `/admin` panel (with `ADMIN_SECRET`) to create a user access code before logging in.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
