import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

function validateNickname(body: unknown): { success: true; nickname: string | null } | { success: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { success: false, error: "Request body must be an object." };
  }

  const rawNickname = (body as Record<string, unknown>).nickname;
  if (typeof rawNickname !== "string") {
    return { success: false, error: 'Field "nickname" must be a string.' };
  }

  const nickname = rawNickname.trim();
  if (nickname.length > 40) {
    return { success: false, error: "Nickname must be at most 40 characters." };
  }

  return { success: true, nickname: nickname || null };
}

// GET /api/profile — returns only the authenticated user's own profile.
router.get("/profile", requireAuth, async (req, res) => {
  const [user] = await db
    .select({ id: usersTable.id, nickname: usersTable.nickname })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  res.json(user);
});

// PUT /api/profile — updates only the authenticated user's own nickname.
router.put("/profile", requireAuth, async (req, res) => {
  const parsed = validateNickname(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid nickname.", details: parsed.error });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ nickname: parsed.nickname })
    .where(eq(usersTable.id, req.session.userId!))
    .returning({ id: usersTable.id, nickname: usersTable.nickname });

  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  res.json(user);
});

export default router;