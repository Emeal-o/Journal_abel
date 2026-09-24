---
name: Workspace dependency restore
description: Restoring already-declared dependencies in a pnpm monorepo workspace when Replit's generic package installer targets the root.
---

When a workspace package's declared dependencies are missing from `node_modules`, first confirm they already exist in that package's manifest and the workspace lockfile. The generic language-package installer may run `pnpm add` at the monorepo root and cannot accept pnpm's workspace filter flags. For restoration without changing manifests, use a workspace-filtered `pnpm install` with the lockfile frozen; include the target package's workspace dependencies as needed.

**Why:** A missing dependency restoration attempt through the generic installer targeted the root and failed with pnpm's workspace-root guard. Passing `--filter` through the installer was rejected as an invalid package token.

**How to apply:** In this pnpm monorepo, distinguish restoring locked workspace dependencies from adding new dependencies. Use the workspace-aware install path for the former; only use a package-add flow when dependency declarations actually need changing.