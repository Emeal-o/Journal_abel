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

// GET /api/setup-types — list active setup types for the authenticated user
router.get("/setup-types", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const types = await db
    .select()
    .from(setupTypesTable)
    .where(and(eq(setupTypesTable.userId, userId), eq(setupTypesTable.active, true)))
    .orderBy(setupTypesTable.createdAt);
  res.json(types.map(serialize));
});

// POST /api/setup-types — create a new setup type
// - If the name matches an existing INACTIVE type, reactivates it (reuses its colour).
// - Rejects at 10 active types per user (hard cap).
// - Auto-assigns a colour from the palette, avoiding colours already active for this user.
router.post("/setup-types", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const { name: rawName } = req.body as { name?: unknown };
  if (typeof rawName !== "string" || rawName.trim().length === 0 || rawName.length > 50) {
    res.status(400).json({ error: "name is required and must be 1–50 characters." });
    return;
  }
  const name = rawName.trim();

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
    // Reactivate the inactive type, preserving its original colour
    const [reactivated] = await db
      .update(setupTypesTable)
      .set({ active: true })
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
  const color = PALETTE.find((c) => !usedColors.has(c)) ?? PALETTE[activeCount % PALETTE.length]!;

  const [created] = await db
    .insert(setupTypesTable)
    .values({ userId, name, color, active: true })
    .returning();
  res.status(201).json(serialize(created!));
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
