import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginEventsTable = pgTable("login_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  ipAddress: text("ip_address").notNull(),
  ipLocation: text("ip_location"),
  browserTimezone: text("browser_timezone"),
  screenResolution: text("screen_resolution"),
  osAndBrowser: text("os_and_browser"),
  accessCodeUsed: text("access_code_used"),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LoginEvent = typeof loginEventsTable.$inferSelect;
