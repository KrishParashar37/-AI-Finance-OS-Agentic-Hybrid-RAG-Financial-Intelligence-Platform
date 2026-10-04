import { db } from "@/db";
import * as s from "@/db/schema";
import { allTxns, monthSeries, forecastSeries, mean, sum, clamp, delta, type TxnRow } from "@/lib/analytics";
import { money } from "@/lib/format";
import type { InsightsPayload, Insight } from "@/lib/types";

export function subMonthly(sub: { amount: number; cycle: string }) {
  if (sub.cycle === "yearly") return sub.amount / 12;
  if (sub.cycle === "weekly") return sub.amount * 4.33;
  return sub.amount;
}

export async function loadContext() {
  const [txns, budgets, subs, bills, goals, accs] = await Promise.all([
    allTxns(),
    db.select().from(s.budgets),
    db.select().from(s.subscriptions),
    db.select().from(s.bills),
    db.select().from(s.goals),
    db.select().from(s.accounts),
  ]);
  return { txns, budgets, subs, bills, goals, accs };
}
export type Ctx = Awaited<ReturnType<typeof loadContext>>;

/** Month-to-date vs. average of previous 3 months (prorated to same day-of-month and full). */
export function categoryStats(txns: TxnRow[]) {
  const now = new Date();
  const day = now.getDate();
  const cur = now.getFullYear() * 12 + now.getMonth();
  const map = new Map<string, { mtd: number; prior: number; full: number[] }>();
  for (const t of txns) {
    if (t.type !== "expense") continue;
    const diff = cur - (t.date.getFullYear() * 12 + t.date.getMonth());
    if (diff < 0 || diff > 6) continue;
    const e = map.get(t.category) ?? { mtd: 0, prior: 0, full: [0, 0, 0, 0, 0, 0] };
    if (diff === 0) e.mtd += t.amount;
    else {
      e.full[diff - 1] += t.amount;
      if (diff <= 3 && t.date.getDate() <= day) e.prior += t.amount;
    }
    map.set(t.category, e);
  }
  return [...map.entries()].map(([name, e]) => ({
    name,
    mtd: e.mtd,
    priorAvg: e.prior / 3,
    avg3: sum(e.full.slice(0, 3)) / 3,
    prev3: sum(e.full.slice(3, 6)) / 3,
  }));
}

export async function getInsights(): Promise<InsightsPayload> {
  const ctx = await loadContext();
  const { txns, budgets, subs, bills, goals, accs } = ctx;
  const monthly = monthSeries(txns, 13);
  const completed = monthly.slice(0, -1);
  const cur = monthly[monthly.length - 1];
  const avgIncome = mean(completed.slice(-3).map((m) => m.income));
  const avgExpense = mean(completed.slice(-3).map((m) => m.expense));
  const cats = categoryStats(txns);
  const activeSubs = subs.filter((x) => x.status === "active");
  const subCost = sum(activeSubs.map(subMonthly));

  // --- health score
  const savingsRate = avgIncome > 0 ? (avgIncome - avgExpense) / avgIncome : 0;
  const catBudgets = budgets.filter((b) => b.category !== "Overall");
  const budgetScores = catBudgets.map((b) => {
    const spent = cats.find((c) => c.name === b.category)?.mtd ?? 0;
    const r = spent / b.limitAmount;
    return r <= 1 ? 100 - Math.max(0, r - 0.75) * 100 : Math.max(0, 60 - (r - 1) * 200);
  });
  const exps = completed.slice(-6).map((m) => m.expense);
  const m = mean(exps);
  const cv = m > 0 ? Math.sqrt(mean(exps.map((x) => (x - m) ** 2))) / m : 0;
  const subRatio = avgIncome > 0 ? subCost / avgIncome : 0;
  const overdue = bills.filter((b) => b.status === "overdue").length;
  const liquid = sum(accs.filter((a) => a.type !== "card").map((a) => a.balance));
  const emergencyMonths = avgExpense > 0 ? liquid / avgExpense : 0;
  const components = [
    { key: "savings", label: "Savings rate", score: clamp((savingsRate / 0.3) * 100), weight: 0.25, detail: `${(savingsRate * 100).toFixed(0)}% of income saved (target 30%)` },
    { key: "budget", label: "Budget adherence", score: clamp(mean(budgetScores) || 80), weight: 0.2, detail: `${budgetScores.filter((x) => x >= 60).length}/${budgetScores.length} budgets on track` },
    { key: "stability", label: "Spending stability", score: clamp(100 - cv * 250), weight: 0.15, detail: `Monthly spending varies ${(cv * 100).toFixed(0)}%` },
    { key: "subs", label: "Subscription load", score: clamp(100 - (subRatio - 0.03) * 1000), weight: 0.1, detail: `${money(subCost)}/mo · ${(subRatio * 100).toFixed(1)}% of income` },
    { key: "bills", label: "Bill discipline", score: clamp(100 - overdue * 30), weight: 0.1, detail: overdue ? `${overdue} overdue bill(s)` : "No overdue bills" },
    { key: "emergency", label: "Emergency fund", score: clamp((emergencyMonths / 6) * 100), weight: 0.2, detail: `${emergencyMonths.toFixed(1)} months of expenses in liquid cash` },
  ].map((c) => ({ ...c, score: Math.round(c.score) }));
  const score = Math.round(sum(components.map((c) => c.score * c.weight)));
  const label = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Fair" : "Needs attention";

  // --- insights
  const insights: Insight[] = [];
  // rolling 30-day window vs. the average of the two previous 30-day windows (stable at any point in the month)
  const roll = new Map<string, number[]>();
  for (const t of txns) {
    if (t.type !== "expense") continue;
    const age = (Date.now() - t.date.getTime()) / 86400000;
    const w = age < 0 ? -1 : Math.floor(age / 30);
    if (w < 0 || w > 2) continue;
    const e = roll.get(t.category) ?? [0, 0, 0];
    e[w] += t.amount;
    roll.set(t.category, e);
  }
  for (const [name, [curW, p1, p2]] of roll) {
    const base = (p1 + p2) / 2;
    const ch = delta(curW, base);
    if (ch !== null && ch > 12 && curW > 1500)
      insights.push({ id: `cat-${name}`, type: "warning", title: `${name} spending is up ${ch.toFixed(0)}%`, body: `Your ${name.toLowerCase()} spending increased ${ch.toFixed(0)}% over the last 30 days compared with your average (${money(curW)} vs ${money(base)}).`, href: "/analytics/categories" });
    if (ch !== null && ch < -20 && base > 1500)
      insights.push({ id: `catdown-${name}`, type: "success", title: `${name} spending down ${Math.abs(ch).toFixed(0)}%`, body: `Nice! You're spending less on ${name.toLowerCase()} than usual.`, href: "/analytics/categories" });
  }
  for (const b of catBudgets) {
    const spent = cats.find((c) => c.name === b.category)?.mtd ?? 0;
    if (spent > b.limitAmount) insights.push({ id: `bud-${b.id}`, type: "alert", title: `${b.category} budget exceeded`, body: `You've spent ${money(spent)} against a ${money(b.limitAmount)} budget (${money(spent - b.limitAmount)} over).`, href: "/budgets" });
    else if (spent > b.limitAmount * 0.85) insights.push({ id: `budw-${b.id}`, type: "warning", title: `${b.category} budget nearly used`, body: `${Math.round((spent / b.limitAmount) * 100)}% of your ${b.category} budget is gone.`, href: "/budgets" });
  }
  const unused = activeSubs.filter((x) => x.lastUsedDays >= 30);
  if (unused.length) insights.push({ id: "subs-unused", type: "warning", title: `${unused.length} subscription${unused.length > 1 ? "s" : ""} may be unused`, body: `${unused.map((x) => x.name).join(", ")} — not used in 30+ days. Cancelling could save ${money(sum(unused.map(subMonthly)) * 12)}/year.`, href: "/subscriptions" });
  for (const x of activeSubs.filter((x) => x.priceChangePct > 0)) insights.push({ id: `price-${x.id}`, type: "info", title: `${x.name} price increased ${x.priceChangePct}%`, body: `Now ${money(x.amount)}/${x.cycle === "monthly" ? "mo" : x.cycle}. Consider a cheaper plan or alternative.`, href: `/subscriptions/${x.id}` });
  const soon = bills.filter((b) => b.status !== "paid" && (b.dueDate.getTime() - Date.now()) / 86400000 <= 7 && (b.dueDate.getTime() - Date.now()) / 86400000 >= -1);
  if (soon.length) insights.push({ id: "bills-soon", type: "info", title: `${soon.length} bill${soon.length > 1 ? "s" : ""} due this week`, body: `${soon.map((b) => `${b.name} (${money(b.amount)})`).join(", ")}.`, href: "/bills" });
  if (overdue) insights.push({ id: "bills-overdue", type: "alert", title: `${overdue} overdue bill${overdue > 1 ? "s" : ""}`, body: "Pay soon to avoid late fees and credit score impact.", href: "/bills" });
  const risky = txns.filter((t) => t.risk === "high" || t.risk === "medium");
  if (risky.length) insights.push({ id: "risk", type: "alert", title: `${risky.length} suspicious transaction${risky.length > 1 ? "s" : ""} flagged`, body: `Largest: ${risky.sort((a, b) => b.amount - a.amount)[0].merchant} ${money(risky[0].amount)}. Review them in the Security Center.`, href: "/ai/anomalies" });
  if (savingsRate >= 0.3) insights.push({ id: "sr-good", type: "success", title: "Great savings rate", body: `You're saving ${(savingsRate * 100).toFixed(0)}% of your income — above the 30% benchmark.` });
  else insights.push({ id: "sr-low", type: "tip", title: "Boost your savings rate", body: `You save ${(savingsRate * 100).toFixed(0)}% of income. Trimming ${money(avgIncome * 0.3 - (avgIncome - avgExpense))}/month would hit the 30% benchmark.` });

  // --- predictions
  const f = forecastSeries(monthly);
  const raw = cats.map((c) => ({ name: c.name, average: c.avg3, predicted: Math.max(0, c.avg3 + (c.avg3 - c.prev3) / 3) })).filter((c) => c.average > 0);
  const rawSum = sum(raw.map((r) => r.predicted)) || 1;
  const factor = f.preds[0] / rawSum;
  const byCategory = raw
    .map((r) => {
      const predicted = Math.round(r.predicted * factor);
      return { name: r.name, predicted, average: Math.round(r.average), change: delta(predicted, r.average) ?? 0 };
    })
    .sort((a, b) => b.predicted - a.predicted);
  const today = new Date();
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthEnd = (cur.expense / Math.max(1, today.getDate())) * dim;

  // --- advice
  const advice: InsightsPayload["advice"] = [];
  const surplus = avgIncome - avgExpense;
  advice.push({ id: "5030", title: "Follow the 50/30/20 rule", body: `With ${money(avgIncome)} monthly income: ${money(avgIncome * 0.5)} needs, ${money(avgIncome * 0.3)} wants, ${money(avgIncome * 0.2)} savings.`, impact: "Framework", icon: "📐" });
  if (emergencyMonths < 6) advice.push({ id: "ef", title: "Build your emergency fund", body: `You hold ${emergencyMonths.toFixed(1)} months of expenses. Target 6 months (${money(avgExpense * 6)}). Auto-transfer ${money(Math.max(2000, surplus * 0.4))}/month.`, impact: `+${money(Math.max(2000, surplus * 0.4) * 12)}/yr`, icon: "🛟" });
  if (surplus > 5000) advice.push({ id: "sip", title: "Put your surplus to work", body: `A SIP of ${money(Math.round((surplus * 0.5) / 500) * 500)}/month in a diversified index fund could grow to ~${money(Math.round(((surplus * 0.5 * (Math.pow(1 + 0.12 / 12, 120) - 1)) / (0.12 / 12)) / 1000) * 1000)} in 10 years at 12% p.a. (illustrative).`, impact: "Wealth", icon: "📈" });
  const top = cats.sort((a, b) => b.avg3 - a.avg3)[0];
  if (top) advice.push({ id: "top", title: `Trim ${top.name} by 10%`, body: `${top.name} is your biggest category at ~${money(top.avg3)}/month. A 10% cut saves ${money(top.avg3 * 0.1 * 12)} a year.`, impact: `+${money(top.avg3 * 0.1 * 12)}/yr`, icon: "✂️" });
  if (unused.length) advice.push({ id: "subs", title: "Cancel unused subscriptions", body: `${unused.map((x) => x.name).join(" & ")} haven't been used recently.`, impact: `+${money(sum(unused.map(subMonthly)) * 12)}/yr`, icon: "🔄" });
  for (const g of goals.slice(0, 2)) {
    const monthsLeft = Math.max(1, Math.round((g.deadline.getTime() - Date.now()) / (30 * 86400000)));
    advice.push({ id: `goal-${g.id}`, title: `${g.name}: save ${money(Math.ceil((g.target - g.saved) / monthsLeft))}/month`, body: `${money(g.target - g.saved)} remaining with ${monthsLeft} months to go.`, impact: `${Math.round((g.saved / g.target) * 100)}% done`, icon: g.emoji });
  }

  const order = { alert: 0, warning: 1, info: 2, tip: 3, success: 4 } as const;
  insights.sort((a, b) => order[a.type] - order[b.type]);

  return {
    health: { score, label, components },
    insights: insights.slice(0, 14),
    predictions: {
      nextMonthTotal: f.preds[0],
      monthEndProjection: Math.round(monthEnd),
      projectedSavings: Math.round(avgIncome - f.preds[0]),
      avgIncome: Math.round(avgIncome),
      avgExpense: Math.round(avgExpense),
      byCategory,
      series: f.series,
    },
    advice,
  };
}
