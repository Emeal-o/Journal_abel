import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const setupTypesTable = pgTable("setup_types", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(), // hex string e.g. "#3B82F6"
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"), // optional user-facing description, max 120 chars enforced at API layer
}, (t) => ({
  uniqueUserIdName: unique("setup_types_user_id_name_key").on(t.userId, t.name),
}));

export type SetupType = typeof setupTypesTable.$inferSelect;
