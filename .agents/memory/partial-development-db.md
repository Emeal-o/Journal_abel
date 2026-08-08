---
name: Partial development database
description: Development PostgreSQL may contain only some tables or incomplete columns even when the code schema is complete.
---

Startup migrations can fail on a development database that was partially provisioned: tables such as `users`, `weeks`, or `trades` may be missing or incomplete while later feature tables already exist.

**Why:** The API's idempotent startup migrations assume the core Drizzle tables and foreign-key columns exist before adding indexes, audit tables, or app settings. A partial database produces misleading feature-startup failures.

**How to apply:** When a startup migration fails on a missing relation or column, inspect `information_schema` and compare against the current Drizzle schema before changing feature code. Repair only the missing development prerequisites; production schema changes follow the publish flow.