---
name: Drizzle-kit push fails non-interactively on fresh DB
description: drizzle-kit push prompts "created or renamed?" for every new table when any unmanaged table exists in the DB; this prompt cannot be answered via piped stdin or a `script`-allocated pty.
---

`drizzle-kit push` (v0.31.x) throws "Interactive prompts require a TTY terminal" and cannot be satisfied by piping newlines to stdin, `yes ""`, or wrapping the command in `script -qec`. The pty accepts the process but the TUI never advances past the first prompt.

**Why:** The prompt ("Is `<table>` table created or renamed from another table?") triggers whenever the target database has any table not tracked in the Drizzle schema (e.g. a `sessions` table created by `connect-pg-simple` outside Drizzle) — Drizzle treats it as a rename candidate for every newly-added table, even with zero actual naming ambiguity.

**How to apply:** For initial/fresh setup, skip `drizzle-kit push` and create the tables directly via `executeSql` with `CREATE TABLE IF NOT EXISTS` DDL matching the Drizzle schema exactly (column names, types, FKs). Once the tables exist with matching names, subsequent `drizzle-kit push` runs (e.g. in `post-merge.sh`) no longer hit the ambiguous-rename prompt for those tables.
