import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, setupTypesTable, type SetupType } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";

/**
 * Curated ~16-colour blue/teal/violet palette for auto-assignment.
 * Colors are picked in order, skipping any already in use by the user's
 * active setup types. If all palette colors are taken (≥16 active types —
 * which is impossible given the MAX_ACTIVE cap of 10) we wrap around.
 */
const PALETTE: string[] = [
  "#3B82F6", // blue-500
  "#06B6D4", // cyan-500
  "#8B5CF6", // violet-500
  "#6366F1", // indigo-500
  "#0EA5E9", // sky-500
  "#14B8A6", // teal-500
  "#A855F7", // purple-500
  "#22D3EE", // cyan-400
  "#818CF8", // indigo-400
  "#7C3AED", // violet-600
  "#0284C7", // sky-600
  "#0D9488", // teal-600
  "#4F46E5", // indigo-600
  "#2563EB", // blue-600
  "#7E22CE", // purple-700
  "#0891B2", // cyan-600
];

const MAX_ACTIVE = 10;

const router: IRouter = Router();

function serialize(t: SetupType) {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

/** Pick the first palette color not in usedColors; wraps around using activeCount as fallback index. */
function pickColor(usedColors: Set<string>, activeCount: number): string {
  return PALETTE.find((c) => !usedColors.has(c)) ?? PALETTE[activeCount % PALETTE.length]!;
}

const DEFAULT_SEEDS: Array<{ name: string; description: string }> = [
  { name: "MSS + Retest",  description: "Market Structure Shift on lower timeframe with entry on pullback/FVG retest." },
  { name: "Breakout",      description: "Clean break through key structural level with follow-through momentum." },
  { name: "Pullback",      description: "Entry on a retracement within an established trend direction." },
  { name: "Reversal",      description: "Countertrend entry at a key level signaling trend exhaustion." },
  { name: "Range Play",    description: "Fading extreme high/low boundaries inside a consolidation range." },
];

// GET /api/setup-types — list active setup types for the authenticated user.
// If the user has zero rows (active or inactive) the 5 default seed types are
// inserted first, then the full active list is returned.
router.get("/setup-types", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // Count ALL rows (active + inactive) to decide whether to seed
  const [{ total }] = await db
    .select({ total: count() })
    .from(setupTypesTable)
    .where(eq(setupTypesTable.userId, userId));

  if (total === 0) {
    // Seed 5 defaults, assigning palette colors in order
    const usedColors = new Set<string>();
    for (let i = 0; i < DEFAULT_SEEDS.length; i++) {
      const seed = DEFAULT_SEEDS[i]!;
      const color = pickColor(usedColors, i);
      usedColors.add(color);
      await db.insert(setupTypesTable).values({
        userId,
        name: seed.name,
        description: seed.description,
        color,
        active: true,
      });
    }
  }

  const types = await db
    .select()
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.userId, userId), eq(setupTypesTable.active, true)))
    .orderBy(setupTypesTable.createdAt);
  res.json(types.map(serialize));
});

// POST /api/setup-types — create a new setup type.
// - Validates name (1–30 chars) and optional description (max 120 chars).
// - If the name matches an existing INACTIVE type, reactivates it (preserves
//   its colour) and updates its description if a new one is provided.
// - Rejects at 10 active types per user (hard cap).
// - Auto-assigns a colour from the palette, avoiding colours already active.
router.post("/setup-types", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const { name: rawName, description: rawDescription } = req.body as {
    name?: unknown;
    description?: unknown;
  };

  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    res.status(400).json({ error: "name is required." });
    return;
  }
  if (rawName.trim().length > 30 || rawName.length > 30) {
    res.status(400).json({ error: "name must be 30 characters or fewer." });
    return;
  }
  const name = rawName.trim();

  let description: string | null = null;
  if (rawDescription !== undefined && rawDescription !== null && rawDescription !== "") {
    if (typeof rawDescription !== "string") {
      res.status(400).json({ error: "description must be a string." });
      return;
    }
    if (rawDescription.length > 120) {
      res.status(400).json({ error: "description must be 120 characters or fewer." });
      return;
    }
    description = rawDescription.trim() || null;
  }

  // Check for an existing type with this name (active or inactive)
  const [existing] = await db
    .select()
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.userId, userId), eq(setupTypesTable.name, name)));

  if (existing) {
    if (existing.active) {
      res.status(409).json({ error: "A setup type with that name already exists." });
      return;
    }
    // Reactivate the inactive type, preserving its original colour.
    // Update description if a new one was provided.
    const updatePayload: { active: boolean; description?: string | null } = { active: true };
    if (description !== null) updatePayload.description = description;

    const [reactivated] = await db
      .update(setupTypesTable)
      .set(updatePayload)
      .where(eq(setupTypesTable.id, existing.id))
      .returning();
    res.status(200).json(serialize(reactivated!));
    return;
  }

  // Count active types — enforce the cap before querying colours
  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.userId, userId), eq(setupTypesTable.active, true)));

  if (activeCount >= MAX_ACTIVE) {
    res.status(422).json({
      error: `You can have at most ${MAX_ACTIVE} active setup types. Remove one before adding a new one.`,
    });
    return;
  }

  // Pick the first palette colour not already used by an active type for this user
  const activeTypes = await db
    .select({ color: setupTypesTable.color })
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.userId, userId), eq(setupTypesTable.active, true)));
  const usedColors = new Set(activeTypes.map((t) => t.color));
  const color = pickColor(usedColors, activeCount);

  const [created] = await db
    .insert(setupTypesTable)
    .values({ userId, name, color, active: true, description })
    .returning();
  res.status(201).json(serialize(created!));
});

// PATCH /api/setup-types/:id — edit name and/or description in place.
//
// Rules:
//  • Name may only be changed within 56 days (8 weeks) of the type's original
//    createdAt. The window is always measured from the original creation date —
//    edits do NOT reset or extend it.
//  • Description may be changed at any time.
//  • If the request includes a name change but the window has closed, the
//    entire request is rejected with a 422 and a clear message.
//  • Color cannot be changed via this endpoint.
router.patch("/setup-types/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const [existing] = await db
    .select()
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.id, id), eq(setupTypesTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const body = req.body as { name?: unknown; description?: unknown };
  const hasName = "name" in body;
  const hasDescription = "description" in body;

  if (!hasName && !hasDescription) {
    res.status(400).json({ error: "Provide at least one of: name, description." });
    return;
  }

  const update: { name?: string; description?: string | null } = {};

  // ── name ──────────────────────────────────────────────────────────────────
  if (hasName) {
    const rawName = body.name;
    if (typeof rawName !== "string" || rawName.trim().length === 0) {
      res.status(400).json({ error: "name must be a non-empty string." });
      return;
    }
    if (rawName.trim().length > 30 || rawName.length > 30) {
      res.status(400).json({ error: "name must be 30 characters or fewer." });
      return;
    }

    // 8-week (56-day) window measured from original createdAt
    const ageMs = Date.now() - existing.createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays > 56) {
      res.status(422).json({
        error: `This setup type's name can no longer be edited (created ${ageDays} days ago — older than 8 weeks). You can still edit its description, or delete it and create a new one.`,
      });
      return;
    }

    const trimmedName = rawName.trim();
    // Check uniqueness if the name is actually changing
    if (trimmedName !== existing.name) {
      const [conflict] = await db
        .select({ id: setupTypesTable.id })
        .from(setupTypesTable)
        .where(and(eq(setupTypesTable.userId, userId), eq(setupTypesTable.name, trimmedName)));
      if (conflict) {
        res.status(409).json({ error: "A setup type with that name already exists." });
        return;
      }
    }
    update.name = trimmedName;
  }

  // ── description ───────────────────────────────────────────────────────────
  if (hasDescription) {
    const rawDesc = body.description;
    if (rawDesc === null || rawDesc === undefined || rawDesc === "") {
      update.description = null;
    } else {
      if (typeof rawDesc !== "string") {
        res.status(400).json({ error: "description must be a string." });
        return;
      }
      if (rawDesc.length > 120) {
        res.status(400).json({ error: "description must be 120 characters or fewer." });
        return;
      }
      update.description = rawDesc.trim() || null;
    }
  }

  const [updated] = await db
    .update(setupTypesTable)
    .set(update)
    .where(eq(setupTypesTable.id, id))
    .returning();

  res.json(serialize(updated!));
});

// DELETE /api/setup-types/:id — soft-delete: sets active = false.
// The row and any setupTypeId references on existing trades are never touched.
router.delete("/setup-types/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const [existing] = await db
    .select({ id: setupTypesTable.id })
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.id, id), eq(setupTypesTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  await db
    .update(setupTypesTable)
    .set({ active: false })
    .where(eq(setupTypesTable.id, id));
  res.status(204).send();
});

export default router;
