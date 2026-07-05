import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeksTable = pgTable("weeks", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  startDate: text("start_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWeekSchema = createInsertSchema(weeksTable).omit({ id: true, createdAt: true });
export type InsertWeek = z.infer<typeof insertWeekSchema>;
export type Week = typeof weeksTable.$inferSelect;
