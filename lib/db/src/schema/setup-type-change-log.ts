import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { tradesTable } from "./trades";
import { usersTable } from "./users";
import { setupTypesTable } from "./setup-types";

export const setupTypeChangeLogTable = pgTable("setup_type_change_log", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id")
    .references(() => tradesTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  oldSetupTypeId: integer("old_setup_type_id").references(() => setupTypesTable.id, { onDelete: "set null" }),
  newSetupTypeId: integer("new_setup_type_id").references(() => setupTypesTable.id, { onDelete: "set null" }),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export type SetupTypeChangeLog = typeof setupTypeChangeLogTable.$inferSelect;
