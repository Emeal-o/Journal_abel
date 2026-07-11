import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const weeksTable = pgTable("weeks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  startDate: text("start_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // null = active/current; a timestamp = archived into a named month
  archivedAt: timestamp("archived_at"),
  // Free-text display label — defaults to "Month {monthInYearFromMonthIndex(monthIndex)}"
  // at archive time, but the user may edit it afterward as a display override.
  monthLabel: text("month_label"),
  // Absolute, never-resetting sequence number assigned at archive time
  // (1, 2, 3, 4... forever — no 13-month rollover). This is the source of
  // truth for ordering/grouping archived weeks; see label-utils.ts for the
  // year/month-in-year derivation used consistently across the app.
  monthIndex: integer("month_index"),
});

export const insertWeekSchema = createInsertSchema(weeksTable).omit({
  id: true, createdAt: true, userId: true, archivedAt: true, monthLabel: true, monthIndex: true,
});
export type InsertWeek = z.infer<typeof insertWeekSchema>;
export type Week = typeof weeksTable.$inferSelect;
