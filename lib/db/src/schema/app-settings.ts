import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  version: text("version").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  honestyNote: text("honesty_note").notNull(),
  bugReportEmail: text("bug_report_email").notNull(),
  creditLine: text("credit_line"),
  privacyPolicy: text("privacy_policy").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({
  updatedAt: true,
});

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;