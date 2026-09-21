---
name: Capacitor native packaging
description: Native packaging constraints for the Trading Journal Capacitor integration.
---

The Trading Journal frontend owns its Capacitor v7 runtime integration, while native project generation is deferred to CI rather than being run in the Replit workspace.

**Why:** The workspace targets Node 20, and the Capacitor CLI installation path is blocked by the package environment; keeping the CLI and generated Android project out of the workspace avoids coupling frontend builds to native generation.

**How to apply:** Keep `capacitor.config.ts` manually maintained, preserve only the five v7 runtime packages, and do not create or modify `android/` or reintroduce a tar override when changing the web frontend.