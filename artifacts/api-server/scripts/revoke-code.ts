/**
 * One-time script: revokes a user's current access code and issues a new one,
 * without touching any of their trades/weeks data.
 *
 * What it does, in order:
 *   1. Generates a brand new cryptographically random access code.
 *   2. Hashes it and overwrites the user's code_hash (old code stops working
 *      immediately — bcrypt hash is gone, so the old plaintext can never match).
 *   3. Deletes every row in the "sessions" table belonging to that user, so any
 *      browser currently logged in with the old (possibly leaked) code is
 *      logged out on its very next request, not just blocked on next login.
 *   4. Prints the new plaintext code ONCE. Store it securely — it cannot be
 *      recovered after this script exits.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run revoke-code -- --user 3
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import type { PoolClient } from "pg";

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

function parseUserId(): number {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--user");
  if (idx === -1) {
    throw new Error("Missing required --user <id> argument. Usage: --user 3");
  }
  const raw = args[idx + 1];
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`Invalid --user value: ${raw}. Must be a positive integer user ID.`);
  }
  return id;
}

const userId = parseUserId();

const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
if (!existing) {
  console.error(`\nNo user found with ID ${userId}. No changes were made.\n`);
  await pool.end();
  process.exit(1);
}

const newCode = generateAccessCode(12);
const newHash = await bcrypt.hash(newCode, 12);

// Replace the code hash AND destroy active sessions in a single transaction,
// so the two changes become visible atomically. Without this, there would be
// a window between the two statements where the old code's session is still
// valid even though the hash has already changed (or vice versa).
let sessionsKilled = 0;
const client: PoolClient = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`UPDATE users SET code_hash = $1 WHERE id = $2`, [newHash, userId]);
  const deleted = await client.query(`DELETE FROM sessions WHERE sess ->> 'userId' = $1`, [String(userId)]);
  sessionsKilled = deleted.rowCount ?? 0;
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
}

console.log("\n==============================================");
console.log(`  ACCESS CODE REVOKED FOR USER ${userId}`);
console.log("==============================================");
console.log(`  New Access Code : ${newCode}`);
console.log(`  Sessions killed : ${sessionsKilled}`);
console.log("==============================================");
console.log("  The old code no longer works. This new code will NOT be shown again.");
console.log("  Trades/weeks data for this user were not modified.\n");

await pool.end();
