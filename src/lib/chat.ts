import { loadContext, getInsights, categoryStats, subMonthly } from "@/lib/ai";
import { mean, sum, monthSeries } from "@/lib/analytics";
import { money, fmtDate } from "@/lib/format";
import { catMeta } from "@/lib/constants";

export type ChatBar = { label: string; emoji: string; value: number; pct: number; color: string };
export type ChatAnswer = { text: string; bars?: ChatBar[] };

function bars(rows: { name: string; value: number }[], total: number, n = 5): ChatBar[] {
  return rows.filter((r) => r.value > 0).slice(0, n).map((r) => ({
    label: r.name,
    emoji: catMeta(r.name).emoji,
    value: Math.round(r.value),
    pct: total ? Math.round((r.value / total) * 100) : 0,
    color: catMeta(r.name).color,
  }));
}

function match(q: string, ...patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(q));
}

export async function answer(message: string): Promise<ChatAnswer> {
  const q = message.toLowerCase().trim();
  const ctx = await loadContext();
  const { txns, budgets, subs, bills, goals, accs } = ctx;
  const monthly = monthSeries(txns, 7);
  const cur = monthly[monthly.length - 1];
  const completed = monthly.slice(0, -1);
  const avgIncome = mean(completed.slice(-3).map((m) => m.income));
  const avgExpense = mean(completed.slice(-3).map((m) => m.expense));
  const cats = categoryStats(txns).sort((a, b) => b.mtd - a.mtd);
  const totalMtd = sum(cats.map((c) => c.mtd));

  // ── Greeting / help ───────────────────────────────────────────────────────
  if (match(q,
    /^(hi|hello|hey|namaste|hii+|helo|hlo|heyy+)\b/,
    /\bhelp\b/,
    /what can you (do|help|tell)/,
    /what (are|r) your (feature|capabilit|function)/,
    /how (do|can) (i|you) use/,
  )) {
    return {
      text: `Hi! 👋 I'm your AI finance assistant. Here's what I can help with:\n\n• 💸 Spending by category or merchant\n• 📊 Budget usage\n• 🔮 Next month predictions\n• 📋 Subscriptions & renewals\n• 🧾 Upcoming bills\n• 🎯 Savings goals\n• 🚨 Unusual / suspicious transactions\n• 💰 Income, balance & net worth\n• 📈 Financial health score\n\nJust ask in plain language!`,
    };
  }

  // ── Save a specific amount ─────────────────────────────────────────────────
  const saveMatch = q.match(/sav\w*\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/);
  if (saveMatch) {
    const goal = Number(saveMatch[1].replace(/,/g, ""));
    const surplus = avgIncome - avgExpense;
    const discretionary = cats
      .filter((c) => ["Shopping", "Food", "Entertainment", "Travel"].includes(c.name))
      .slice(0, 3);
    const ok = surplus >= goal;
    return {
      text: `${ok ? "Yes — you can." : "It's tight, but possible."} Your average monthly surplus is ${money(surplus)} (income ${money(avgIncome)} − expenses ${money(avgExpense)}). ${ok ? `Saving ${money(goal)} leaves ${money(surplus - goal)} of breathing room.` : `You'd need to cut about ${money(goal - surplus)} from discretionary spending.`}\n\nBiggest places to trim this month:`,
      bars: bars(discretionary.map((c) => ({ name: c.name, value: c.mtd })), totalMtd, 3),
    };
  }

  // ── General savings / surplus question ────────────────────────────────────
  if (match(q,
    /\bsav(e|ing|ings|ed)?\b/,
    /how much (am i|can i|do i|did i) sav/,
    /am i saving/,
    /my savings/,
    /surplus/,
  )) {
    const surplus = avgIncome - avgExpense;
    const rate = avgIncome > 0 ? Math.round((surplus / avgIncome) * 100) : 0;
    return {
      text: `Your average monthly savings is ${money(surplus)} — that's a ${rate}% savings rate.\n\nIncome avg: ${money(avgIncome)}\nExpense avg: ${money(avgExpense)}\n\nThis month so far: earned ${money(cur.income)}, spent ${money(cur.expense)}, net ${money(cur.income - cur.expense)}.`,
    };
  }

  // ── Anomalies / fraud / suspicious ────────────────────────────────────────
  if (match(q,
    /unusual|anomal|suspicious|fraud|risk/,
    /flagged|duplicate/,
    /scam|stolen|unauthori/,
  )) {
    const risky = txns
      .filter((t) => t.risk !== "low" || t.riskReason.startsWith("Duplicate"))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
    if (!risky.length) return { text: "All clear — I found no unusual transactions. 🎉" };
    return {
      text: `I found ${risky.length} transactions worth reviewing:\n\n${risky.map((t) => `• ${t.merchant} ${money(t.amount)} on ${fmtDate(t.date)} — ${t.risk.toUpperCase()}: ${t.riskReason || "flagged"}`).join("\n")}\n\nOpen the Security Center to mark them safe or report fraud.`,
    };
  }

  // ── Predictions / forecast ────────────────────────────────────────────────
  if (match(q,
    /predict|forecast|next month|project/,
    /how much will i spend/,
    /estimate.*spend/,
    /future.*spend/,
    /what.*spend.*next/,
  )) {
    const ins = await getInsights();
    return {
      text: `Based on your last 6 months, I expect you to spend about ${money(ins.predictions.nextMonthTotal)} next month. This month is on track for ${money(ins.predictions.monthEndProjection)}, and your projected savings is ${money(ins.predictions.projectedSavings)}.\n\nPredicted top categories:`,
      bars: bars(ins.predictions.byCategory.map((c) => ({ name: c.name, value: c.predicted })), ins.predictions.nextMonthTotal, 4),
    };
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────
  if (match(q,
    /subscri|netflix|spotify|amazon prime|hotstar|renew/,
    /recurring (payment|charge|bill)/,
    /monthly (service|app|plan)/,
    /which (app|service).*pay/,
  )) {
    const active = subs.filter((x) => x.status === "active");
    const unused = active.filter((x) => x.lastUsedDays >= 30);
    const total = sum(active.map(subMonthly));
    return {
      text: `You have ${active.length} active subscriptions costing ${money(total)}/month.\n\n${active.map((x) => `• ${x.name} — ${money(x.amount)} (renews ${fmtDate(x.nextRenewal)})`).join("\n")}\n\n${unused.length ? `⚠️ ${unused.map((x) => x.name).join(" and ")} look unused — cancelling saves ${money(sum(unused.map(subMonthly)) * 12)}/year.` : "All subscriptions look actively used."}`,
    };
  }

  // ── Budgets ────────────────────────────────────────────────────────────────
  if (match(q,
    /budget/,
    /over.*(limit|spend)/,
    /how.*limit/,
    /am i within/,
    /spending limit/,
  )) {
    const rows = budgets
      .filter((b) => b.category !== "Overall")
      .map((b) => ({
        name: b.category,
        spent: cats.find((c) => c.name === b.category)?.mtd ?? 0,
        limit: b.limitAmount,
      }));
    const over = rows.filter((r) => r.spent > r.limit);
    return {
      text: `${over.length ? `⚠️ You're over budget in: ${over.map((o) => o.name).join(", ")}.` : "✅ You're within all your budgets."} Here's usage this month:`,
      bars: rows
        .map((r) => ({
          label: `${r.name} (${money(r.spent)} / ${money(r.limit)})`,
          emoji: catMeta(r.name).emoji,
          value: Math.round(r.spent),
          pct: Math.round((r.spent / r.limit) * 100),
          color: r.spent > r.limit ? "#ef4444" : catMeta(r.name).color,
        }))
        .slice(0, 6),
    };
  }

  // ── Bills / due payments ───────────────────────────────────────────────────
  if (match(q,
    /bill|due|payment due|overdue/,
    /what.*pay(ing)?.*(this|next) month/,
    /upcoming.*payment/,
    /when.*pay/,
  )) {
    const pending = bills.filter((b) => b.status !== "paid").sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return {
      text: pending.length
        ? `You have ${pending.length} unpaid bills totalling ${money(sum(pending.map((b) => b.amount)))}:\n\n${pending.map((b) => `• ${b.name} ${money(b.amount)} — due ${fmtDate(b.dueDate)}${b.status === "overdue" ? " ⚠️ OVERDUE" : ""}`).join("\n")}`
        : "No pending bills. 🎉",
    };
  }

  // ── Goals ──────────────────────────────────────────────────────────────────
  if (match(q,
    /goal|target|saving for|dream|milestone/,
    /how (close|far) am i/,
    /progress.*saving/,
    /saving.*for/,
  )) {
    return {
      text: goals.length
        ? `Your savings goals:\n\n${goals.map((g) => `${g.emoji} ${g.name}: ${money(g.saved)} / ${money(g.target)} (${Math.round((g.saved / g.target) * 100)}%)`).join("\n")}`
        : "You haven't set any savings goals yet. Go to Goals to create one!",
    };
  }

  // ── Income / salary ────────────────────────────────────────────────────────
  if (match(q,
    /income|salary|earn|paycheck|credit.*month|how much.*earn/,
    /how much.*receiv/,
    /total.*income/,
    /money.*come in/,
  )) {
    return {
      text: `This month you've earned ${money(cur.income)}. Your 3-month average income is ${money(avgIncome)}, with an average savings of ${money(avgIncome - avgExpense)} per month.`,
    };
  }

  // ── Balance / net worth / accounts ────────────────────────────────────────
  if (match(q,
    /balance|net worth|total money|how much.*have|account/,
    /\bcash\b|wallet|bank/,
    /how much (do|did) i have/,
    /overall.*balance/,
  )) {
    return {
      text: `Your net balance across ${accs.length} accounts is ${money(sum(accs.map((a) => a.balance)))}.\n\n${accs.map((a) => `• ${a.name}: ${money(a.balance)}`).join("\n")}`,
    };
  }

  // ── Transactions / recent spending ────────────────────────────────────────
  if (match(q,
    /recent|latest|last.*transaction|transaction.*list/,
    /what did i (buy|spend on|purchase)/,
    /show.*transaction/,
  )) {
    const recent = txns
      .filter((t) => t.type === "expense")
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
    return {
      text: recent.length
        ? `Your 8 most recent expenses:\n\n${recent.map((t) => `• ${t.merchant} — ${money(t.amount)} on ${fmtDate(t.date)} (${t.category})`).join("\n")}`
        : "No recent transactions found.",
    };
  }

  // ── Top merchants ──────────────────────────────────────────────────────────
  if (match(q,
    /merchant|store|shop/,
    /where.*spend.*most/,
    /top.*merchant/,
    /which.*shop/,
  )) {
    const m = new Map<string, number>();
    for (const t of txns.filter((x) => x.type === "expense" && x.date.getMonth() === new Date().getMonth())) {
      m.set(t.merchant, (m.get(t.merchant) ?? 0) + t.amount);
    }
    const rows = [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return {
      text: rows.length
        ? `Top merchants this month:\n\n${rows.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} — ${money(r.value)}`).join("\n")}`
        : "No merchant data this month yet.",
    };
  }

  // ── Category / spending breakdown ─────────────────────────────────────────
  if (match(q,
    /most|highest|biggest|top spend/,
    /where.*spend|spend.*where/,
    /categor|breakdown|how much.*spend/,
    /expense.*categor|categor.*expense/,
    /what.*spend/,
    /how.*money.*spend/,
    /total.*spend|spend.*total/,
    /\bspend\b|\bspent\b|\bexpens/,
  )) {
    if (!cats.length) return { text: "You haven't logged any expenses this month yet." };
    const top = cats[0];
    return {
      text: `Your highest spending category is **${top.name}** with ${money(top.mtd)}, representing ${Math.round((top.mtd / totalMtd) * 100)}% of your expenses.\n\nTotal spent this month: ${money(totalMtd)}`,
      bars: bars(cats.map((c) => ({ name: c.name, value: c.mtd })), totalMtd, 5),
    };
  }

  // ── Financial health ───────────────────────────────────────────────────────
  if (match(q,
    /health|score|financial (status|situation|condition)/,
    /how am i doing/,
    /am i (okay|ok|good|doing well|on track)/,
    /overall (summary|picture|status)/,
    /summary|overview/,
  )) {
    const ins = await getInsights();
    return {
      text: `Your financial health score is **${ins.health.score}/100** (${ins.health.label}).\n\nThis month:\n• Earned: ${money(cur.income)}\n• Spent: ${money(cur.expense)}\n• Net: ${money(cur.income - cur.expense)}\n\nAverage savings rate: ${avgIncome > 0 ? Math.round(((avgIncome - avgExpense) / avgIncome) * 100) : 0}%`,
    };
  }

  // ── Food / dining specific ─────────────────────────────────────────────────
  if (match(q,
    /food|dining|restaurant|eat(ing)?|lunch|dinner|breakfast|zomato|swiggy/,
  )) {
    const foodCat = cats.find((c) => c.name.toLowerCase() === "food");
    if (!foodCat) return { text: "No food expenses recorded this month." };
    return {
      text: `You've spent ${money(foodCat.mtd)} on food this month, which is ${Math.round((foodCat.mtd / totalMtd) * 100)}% of your total expenses.`,
    };
  }

  // ── Shopping specific ──────────────────────────────────────────────────────
  if (match(q,
    /shopping|clothes|fashion|amazon|flipkart|online.*shop/,
  )) {
    const shopCat = cats.find((c) => c.name.toLowerCase() === "shopping");
    if (!shopCat) return { text: "No shopping expenses recorded this month." };
    return {
      text: `You've spent ${money(shopCat.mtd)} on shopping this month, which is ${Math.round((shopCat.mtd / totalMtd) * 100)}% of your total expenses.`,
    };
  }

  // ── Travel / transport ─────────────────────────────────────────────────────
  if (match(q,
    /travel|transport|uber|ola|cab|flight|trip|fuel|petrol/,
  )) {
    const travelCat = cats.find((c) => ["travel", "transport"].includes(c.name.toLowerCase()));
    if (!travelCat) return { text: "No travel/transport expenses recorded this month." };
    return {
      text: `You've spent ${money(travelCat.mtd)} on ${travelCat.name} this month.`,
    };
  }

  // ── Entertainment ──────────────────────────────────────────────────────────
  if (match(q,
    /entertainment|movie|games|fun|leisure/,
  )) {
    const entCat = cats.find((c) => c.name.toLowerCase() === "entertainment");
    if (!entCat) return { text: "No entertainment expenses recorded this month." };
    return {
      text: `You've spent ${money(entCat.mtd)} on entertainment this month.`,
    };
  }

  // ── Generic "how much did I spend" without category ────────────────────────
  if (match(q,
    /how much (did|have) i spend/,
    /total expense/,
    /my expense/,
  )) {
    return {
      text: `You've spent ${money(totalMtd)} this month across ${cats.length} categories.\n\nTop categories:`,
      bars: bars(cats.map((c) => ({ name: c.name, value: c.mtd })), totalMtd, 5),
    };
  }

  // ── Catch-all fallback with useful snapshot ────────────────────────────────
  const ins = await getInsights();
  return {
    text: `Here's your financial snapshot:\n\n💰 Earned: ${money(cur.income)}\n💸 Spent: ${money(totalMtd)}\n🏦 Net balance: ${money(sum(accs.map((a) => a.balance)))}\n📊 Health score: ${ins.health.score}/100\n\nI can answer questions about spending, budgets, bills, goals, subscriptions, predictions, and more. Try:\n• "Where did I spend the most?"\n• "How are my budgets?"\n• "Show upcoming bills"\n• "Predict next month"\n• "Am I saving money?"`,
    bars: bars(cats.map((c) => ({ name: c.name, value: c.mtd })), totalMtd, 5),
  };
}
