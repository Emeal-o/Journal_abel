import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

type AppSettingsInput = {
  version: string;
  tagline: string;
  description: string;
  honesty_note: string;
  bug_report_email: string;
};

function validateAppSettingsInput(body: unknown): { success: true; data: AppSettingsInput } | { success: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { success: false, error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;
  const fields: { key: keyof AppSettingsInput; max: number }[] = [
    { key: "version", max: 50 },
    { key: "tagline", max: 500 },
    { key: "description", max: 2000 },
    { key: "honesty_note", max: 2000 },
    { key: "bug_report_email", max: 254 },
  ];
  const data: Partial<AppSettingsInput> = {};
  for (const { key, max } of fields) {
    const value = b[key];
    if (typeof value !== "string") {
      return { success: false, error: `Field "${key}" must be a string.` };
    }
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      return { success: false, error: `Field "${key}" must not be empty.` };
    }
    if (trimmed.length > max) {
      return { success: false, error: `Field "${key}" must be at most ${max} characters.` };
    }
    data[key] = trimmed;
  }
  return { success: true, data: data as AppSettingsInput };
}

function serializeAppSettings(settings: typeof appSettingsTable.$inferSelect) {
  return {
    id: settings.id,
    version: settings.version,
    tagline: settings.tagline,
    description: settings.description,
    honesty_note: settings.honestyNote,
    bug_report_email: settings.bugReportEmail,
    updated_at: settings.updatedAt.toISOString(),
  };
}

// GET /api/app-settings — About content is public.
router.get("/app-settings", async (_req, res) => {
  const [settings] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1));

  if (!settings) {
    res.status(404).json({ error: "App settings are not configured." });
    return;
  }

  res.json(serializeAppSettings(settings));
});

// PUT /api/app-settings — only an authenticated admin may edit About content.
router.put("/app-settings", requireAdmin, async (req, res) => {
  const parsed = validateAppSettingsInput(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid About content.", details: parsed.error });
    return;
  }

  const [settings] = await db
    .update(appSettingsTable)
    .set({
      version: parsed.data.version,
      tagline: parsed.data.tagline,
      description: parsed.data.description,
      honestyNote: parsed.data.honesty_note,
      bugReportEmail: parsed.data.bug_report_email,
      updatedAt: new Date(),
    })
    .where(eq(appSettingsTable.id, 1))
    .returning();

  if (!settings) {
    res.status(404).json({ error: "App settings are not configured." });
    return;
  }

  res.json(serializeAppSettings(settings));
});

export default router;
