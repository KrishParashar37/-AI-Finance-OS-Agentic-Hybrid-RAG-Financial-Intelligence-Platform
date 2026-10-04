import { db } from "@/db";
import { budgets } from "@/db/schema";
import { route } from "@/lib/api";
import { loadContext, categoryStats } from "@/lib/ai";
import { sum } from "@/lib/analytics";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Generates a smart budget from the last 3 months of actual spending (5% stretch savings target). */
export const POST = route(async () => {
  const { txns } = await loadContext();
  const cats = categoryStats(txns).filter((c) => c.avg3 > 300);
  const rows = cats.map((c) => ({ category: c.name, limitAmount: Math.max(500, Math.round((c.avg3 * 0.95) / 100) * 100) }));
  const overall = Math.round((sum(rows.map((r) => r.limitAmount)) * 1.05) / 500) * 500;
  await db.delete(budgets);
  const newBudgets = [{ category: "Overall", limitAmount: overall }, ...rows];
  await db.insert(budgets).values(newBudgets);
  await logActivity("Smart budget generated", `${newBudgets.length} budgets from 3-month averages`);
  return { budgets: newBudgets };
});
