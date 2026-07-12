---
name: Mobile right-edge dead space from nav overflow
description: How an unwrapped horizontal nav bar causes right-side dead space on mobile (not a container/width bug)
---

A single-row header nav (logo + several text+icon links + divider + button) that doesn't
shrink/wrap will exceed the mobile viewport width, pushing the whole document's scroll
width wider than the viewport. Content sections below render correctly at 100% width,
but the page becomes horizontally scrollable, revealing blank space to the right of the
main content once scrolled — it looks like a "dead space on the right edge" bug in the
main content, but the real cause is upstream in the header/nav, not in `main`'s
container/width classes.

**Why:** Spent significant time inspecting `Layout`'s `container`, page-level markup, and
one-off fixed-width components (export card, table overflow wrapper) before finding the
actual cause was the nav row overflowing at narrow widths.

**How to apply:** When debugging "empty space on one edge on mobile", check for horizontal
overflow first (any element wider than the viewport, most often a header/nav or a wide
table) before assuming a container/width class in the main content is wrong. Fix by
hiding/collapsing nav text labels below the relevant breakpoint (icon-only on mobile), and
add a defensive `overflow-x-hidden` on `html`/`body` as a safety net against future
regressions of the same kind.
