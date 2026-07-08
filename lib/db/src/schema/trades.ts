import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weeksTable } from "./weeks";
import { usersTable } from "./users";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  weekId: integer("week_id").references(() => weeksTable.id, { onDelete: "cascade" }).notNull(),
  tradeNumber: integer("trade_number").notNull(),
  result: text("result").notNull(), // "Win" | "Loss" | "BE"
  rrr: real("rrr").notNull(),
  pips: real("pips").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, tradeNumber: true, createdAt: true, userId: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
