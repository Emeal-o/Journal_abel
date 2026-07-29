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

Dev database note: this Repl's database is a Replit-provisioned Postgres instance (accessed via `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` runtime env vars), separate from the production Neon DB used by the Vercel deployment.

### Fresh-install setup (new Replit import)

1. `pnpm install` — install all workspace dependencies
2. Initialize the core DB tables (idempotent):
   ```sh
   psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER" \
     -f artifacts/api-server/scripts/init-db.sql
   ```
3. Set the `ADMIN_SECRET` secret in Replit Secrets (any strong password).
4. `SESSION_SECRET` is also required — set it in Replit Secrets.
5. Start both workflows from the Workflows panel (or they auto-start).
6. Visit `/admin` with your `ADMIN_SECRET` to create the first access code, or run `pnpm --filter @workspace/api-server run create-user`.

The server's startup migration (`artifacts/api-server/src/index.ts`) handles `sessions`, `login_events`, and `ALTER TABLE` additions automatically on every boot — no manual step needed for those.

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
