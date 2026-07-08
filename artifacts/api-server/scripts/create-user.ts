/**
 * One-time script: creates one or more new users, each with a cryptographically
 * random access code.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run create-user            # creates 1 user
 *   pnpm --filter @workspace/api-server run create-user -- --count 4  # creates 4 users
 *
 * The plain-text codes are printed ONCE to stdout. Store them securely —
 * they cannot be recovered after this script exits (only the bcrypt hash is stored).
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db, pool, usersTable } from "@workspace/db";

function generateAccessCode(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length * 4);
  let code = "";
  for (let i = 0; i < bytes.length && code.length < length; i++) {
    // Reject bytes above the largest multiple of chars.length to eliminate bias
    if ((bytes[i] as number) < Math.floor(256 / chars.length) * chars.length) {
      code += chars[(bytes[i] as number) % chars.length];
    }
  }
  // Recurse for the rare case we run out of unbiased bytes
  return code.length < length ? code + generateAccessCode(length - code.length) : code;
}

function parseCount(): number {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--count");
  if (idx === -1) return 1;
  const raw = args[idx + 1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error(`Invalid --count value: ${raw}. Must be an integer between 1 and 100.`);
  }
  return n;
}

const count = parseCount();

console.log("\n==============================================");
console.log(`  CREATING ${count} NEW USER(S) — SAVE EACH CODE AS IT APPEARS`);
console.log("==============================================");

// Codes are printed immediately after each successful insert (not batched at
// the end) so that if a later iteration fails, the users already created are
// not left with unrecoverable codes.
for (let i = 0; i < count; i++) {
  const code = generateAccessCode(12);
  const hash = await bcrypt.hash(code, 12);
  const [user] = await db.insert(usersTable).values({ codeHash: hash }).returning();
  console.log(`  User ${user!.id.toString().padEnd(4)} : ${code}`);
}

console.log("==============================================");
console.log("  These codes will NOT be shown again.\n");

await pool.end();
