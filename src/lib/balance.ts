import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";

/** Applies (dir=1) or reverses (dir=-1) a transaction's effect on its account balance. */
export async function applyBalance(accountId: number | null | undefined, type: string, amount: number, dir: 1 | -1) {
  if (!accountId) return;
  const d = (type === "income" ? 1 : -1) * amount * dir;
  await db.update(accounts).set({ balance: sql`${accounts.balance} + ${d}` }).where(eq(accounts.id, accountId));
}
