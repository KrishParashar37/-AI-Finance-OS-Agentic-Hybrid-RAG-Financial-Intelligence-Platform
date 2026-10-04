import type { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { applyBalance } from "@/lib/balance";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const { action, ids, category } = (await req.json()) as { action: string; ids: number[]; category?: string };
  if (!Array.isArray(ids) || ids.length === 0) return bad("No items selected");
  if (action === "delete") {
    const rows = await db.select().from(transactions).where(inArray(transactions.id, ids));
    await db.delete(transactions).where(inArray(transactions.id, ids));
    for (const r of rows) await applyBalance(r.accountId, r.type, r.amount, -1);
  } else if (action === "category" && category) {
    await db.update(transactions).set({ category }).where(inArray(transactions.id, ids));
  } else if (action === "recurring") {
    await db.update(transactions).set({ recurring: true }).where(inArray(transactions.id, ids));
  } else if (action === "safe") {
    await db.update(transactions).set({ risk: "low", riskReason: "Reviewed: marked safe" }).where(inArray(transactions.id, ids));
  } else return bad("Unknown action");
  await logActivity("Bulk action", `${action} on ${ids.length} transactions`);
  return { ok: true, count: ids.length };
});
