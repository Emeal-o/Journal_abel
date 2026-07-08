/**
 * One-time script: creates a new user with a random access code.
 * Run with: pnpm --filter @workspace/scripts tsx create-user.ts
 *
 * The plain-text code is printed ONCE. Store it securely — it cannot be recovered.
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../lib/db/src/schema/index.js";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function generateAccessCode(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length * 4);
  let code = "";
  for (let i = 0; i < bytes.length && code.length < length; i++) {
    if (bytes[i]! < Math.floor(256 / chars.length) * chars.length) {
      code += chars[bytes[i]! % chars.length];
    }
  }
  if (code.length < length) return generateAccessCode(length - code.length);
  return code;
}

const code = generateAccessCode(12);
const hash = await bcrypt.hash(code, 12);
const [user] = await db.insert(schema.usersTable).values({ codeHash: hash }).returning();

console.log("\n========================================");
console.log(" NEW USER CREATED — SAVE THIS CODE NOW ");
console.log("========================================");
console.log(`  User ID    : ${user!.id}`);
console.log(`  Access Code: ${code}`);
console.log("========================================");
console.log("  This code will NOT be shown again.\n");

await pool.end();
