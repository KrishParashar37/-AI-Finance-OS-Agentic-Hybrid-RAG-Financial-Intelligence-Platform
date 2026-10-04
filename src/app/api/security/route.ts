import { desc } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { route } from "@/lib/api";
import { clamp } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const txns = await db.select().from(transactions).orderBy(desc(transactions.date));
  const expenses = txns.filter((t) => t.type === "expense");
  const high = expenses.filter((t) => t.risk === "high");
  const medium = expenses.filter((t) => t.risk === "medium");
  const dups = expenses.filter((t) => t.risk === "low" && t.riskReason.startsWith("Duplicate"));
  const riskScore = Math.round(clamp(high.length * 8 + medium.length * 4 + dups.length * 1.5));
  const flagged = [...high, ...medium, ...dups].sort((a, b) => b.amount - a.amount);
  const cutoff = Date.now() - 30 * 86400000;
  const lows = expenses
    .filter((t) => t.risk === "low" && !t.riskReason.startsWith("Duplicate") && t.date.getTime() > cutoff)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, Math.max(0, 10 - flagged.length));
  return {
    riskScore,
    normal: expenses.length - high.length - medium.length - dups.length,
    suspicious: high.length + medium.length,
    duplicates: dups.length,
    flagged: [...flagged, ...lows],
  };
});
