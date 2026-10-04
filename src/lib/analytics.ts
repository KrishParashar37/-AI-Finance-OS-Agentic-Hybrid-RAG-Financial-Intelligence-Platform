import { asc } from "drizzle-orm";
import { db } from "@/db";
import { transactions, accounts } from "@/db/schema";
import type { Stats } from "@/lib/types";

export const DAY = 86400000;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export type TxnRow = typeof transactions.$inferSelect;

export async function allTxns() {
  return db.select().from(transactions).orderBy(asc(transactions.date));
}

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
export const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const dKey = (d: Date) => `${ymKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export function monthSeries(txns: TxnRow[], n: number) {
  const now = new Date();
  const out: { key: string; label: string; income: number; expense: number; net: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: ymKey(d), label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, income: 0, expense: 0, net: 0 });
  }
  const idx = new Map(out.map((o) => [o.key, o]));
  for (const t of txns) {
    const o = idx.get(ymKey(t.date));
    if (!o) continue;
    if (t.type === "income") o.income += t.amount;
    else o.expense += t.amount;
  }
  out.forEach((o) => (o.net = o.income - o.expense));
  return out;
}

export function resolveRange(range: string, from?: string | null, to?: string | null) {
  let end = new Date();
  end.setHours(23, 59, 59, 999);
  let start: Date;
  if (range === "custom" && from && to) {
    start = new Date(from);
    start.setHours(0, 0, 0, 0);
    end = new Date(to);
    end.setHours(23, 59, 59, 999);
  } else {
    const map: Record<string, number> = { "7d": 7, "30d": 30, "3m": 90, "6m": 182, "1y": 365 };
    const days = map[range] ?? 30;
    start = new Date(end.getTime() - (days - 1) * DAY);
    start.setHours(0, 0, 0, 0);
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  return { start, end, days };
}

export function forecastSeries(monthly: { label: string; expense: number }[]) {
  const completed = monthly.slice(0, -1);
  const last3 = completed.slice(-3).map((m) => m.expense);
  const prev3 = completed.slice(-6, -3).map((m) => m.expense);
  const avg3 = mean(last3);
  const slope = prev3.length ? (avg3 - mean(prev3)) / 3 : 0;
  const now = new Date();
  const series: { label: string; actual?: number; forecast?: number }[] = monthly.slice(-7, -1).map((m) => ({ label: m.label, actual: Math.round(m.expense) }));
  const lastActual = series[series.length - 1];
  if (lastActual) lastActual.forecast = lastActual.actual;
  const preds: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const v = Math.max(0, Math.round(avg3 + slope * i));
    preds.push(v);
    series.push({ label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, forecast: v });
  }
  return { series, preds, avg3 };
}

export async function getStats(range: string, from?: string | null, to?: string | null): Promise<Stats> {
  const [txns, accs] = await Promise.all([allTxns(), db.select().from(accounts)]);
  const { start, end, days } = resolveRange(range, from, to);
  const prevStart = new Date(start.getTime() - days * DAY);
  const prevEnd = new Date(start.getTime() - 1);
  const inR = txns.filter((t) => t.date >= start && t.date <= end);
  const inP = txns.filter((t) => t.date >= prevStart && t.date <= prevEnd);
  const exp = inR.filter((t) => t.type === "expense");
  const inc = inR.filter((t) => t.type === "income");
  const income = sum(inc.map((t) => t.amount));
  const expense = sum(exp.map((t) => t.amount));
  const prevIncome = sum(inP.filter((t) => t.type === "income").map((t) => t.amount));
  const prevExpense = sum(inP.filter((t) => t.type === "expense").map((t) => t.amount));
  const net = income - expense;
  const prevNet = prevIncome - prevExpense;
  const largestT = exp.reduce<TxnRow | null>((a, b) => (!a || b.amount > a.amount ? b : a), null);

  // trend buckets
  const mode = days <= 31 ? "day" : days <= 100 ? "week" : "month";
  const buckets = new Map<string, { label: string; date: string; expense: number; income: number }>();
  const bucketOf = (d: Date) => {
    if (mode === "day") return { key: dKey(d), label: `${d.getDate()} ${MONTHS[d.getMonth()]}` };
    if (mode === "week") {
      const st = new Date(d);
      st.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return { key: dKey(st), label: `${st.getDate()} ${MONTHS[st.getMonth()]}` };
    }
    return { key: ymKey(d), label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` };
  };
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const d = new Date(t);
    const b = bucketOf(d);
    if (!buckets.has(b.key)) buckets.set(b.key, { label: b.label, date: d.toISOString(), expense: 0, income: 0 });
  }
  for (const t of inR) {
    const b = buckets.get(bucketOf(t.date).key);
    if (!b) continue;
    if (t.type === "expense") b.expense += t.amount;
    else b.income += t.amount;
  }
  const trend = [...buckets.values()].map((b) => ({ ...b, expense: Math.round(b.expense), income: Math.round(b.income) }));

  // categories
  const cat = new Map<string, { value: number; count: number; prev: number }>();
  for (const t of exp) {
    const c = cat.get(t.category) ?? { value: 0, count: 0, prev: 0 };
    c.value += t.amount;
    c.count++;
    cat.set(t.category, c);
  }
  for (const t of inP.filter((x) => x.type === "expense")) {
    const c = cat.get(t.category) ?? { value: 0, count: 0, prev: 0 };
    c.prev += t.amount;
    cat.set(t.category, c);
  }
  const categories = [...cat.entries()]
    .filter(([, v]) => v.value > 0)
    .map(([name, v]) => ({ name, value: Math.round(v.value), count: v.count, prev: Math.round(v.prev), pct: expense ? (v.value / expense) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // merchants
  const mer = new Map<string, { total: number; count: number; cats: Map<string, number> }>();
  for (const t of exp) {
    const m = mer.get(t.merchant) ?? { total: 0, count: 0, cats: new Map() };
    m.total += t.amount;
    m.count++;
    m.cats.set(t.category, (m.cats.get(t.category) ?? 0) + 1);
    mer.set(t.merchant, m);
  }
  const merchants = [...mer.entries()]
    .map(([name, m]) => ({
      name,
      total: Math.round(m.total),
      count: m.count,
      avg: Math.round(m.total / m.count),
      category: [...m.cats.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // weekday
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const wd = names.map((day) => ({ day, total: 0 }));
  for (const t of exp) wd[(t.date.getDay() + 6) % 7].total += t.amount;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weekday = wd.map((w) => ({ day: w.day, total: Math.round(w.total), avg: Math.round(w.total / weeks) }));

  // heatmap: 12 weeks ending this week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mon = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY);
  const hStart = new Date(mon.getTime() - 11 * 7 * DAY);
  const hm = new Map<string, number>();
  for (const t of txns) if (t.type === "expense" && t.date >= hStart) hm.set(dKey(t.date), (hm.get(dKey(t.date)) ?? 0) + t.amount);
  const heatmap: { date: string; amount: number }[] = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(hStart.getTime() + i * DAY);
    heatmap.push({ date: d.toISOString(), amount: d > today ? -1 : Math.round(hm.get(dKey(d)) ?? 0) });
  }

  const monthly = monthSeries(txns, 12);
  const yr = new Map<string, { income: number; expense: number }>();
  for (const t of txns) {
    const y = String(t.date.getFullYear());
    const o = yr.get(y) ?? { income: 0, expense: 0 };
    if (t.type === "income") o.income += t.amount;
    else o.expense += t.amount;
    yr.set(y, o);
  }
  const yearly = [...yr.entries()].sort().map(([year, v]) => ({ year, income: Math.round(v.income), expense: Math.round(v.expense), net: Math.round(v.income - v.expense) }));

  const cur = monthly[monthly.length - 1];
  const last = monthly[monthly.length - 2];
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const perDay = cur.expense / Math.max(1, today.getDate());
  const velocity = {
    spentMtd: Math.round(cur.expense),
    perDay: Math.round(perDay),
    projected: Math.round(perDay * dim),
    daysLeft: dim - today.getDate(),
    lastMonth: Math.round(last?.expense ?? 0),
    vsLastMonth: delta(perDay * dim, last?.expense ?? 0),
  };

  return {
    range: { start: start.toISOString(), end: end.toISOString(), days },
    balance: Math.round(sum(accs.map((a) => a.balance))),
    totals: {
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(net),
      savingsRate: income > 0 ? (net / income) * 100 : 0,
      count: inR.length,
      avg: exp.length ? Math.round(expense / exp.length) : 0,
      largest: largestT ? { merchant: largestT.merchant, amount: largestT.amount, date: largestT.date.toISOString() } : null,
      prevIncome: Math.round(prevIncome),
      prevExpense: Math.round(prevExpense),
      incomeDelta: delta(income, prevIncome),
      expenseDelta: delta(expense, prevExpense),
      netDelta: prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null,
    },
    trend,
    categories,
    merchants,
    weekday,
    heatmap,
    monthly: monthly.map((m) => ({ ...m, income: Math.round(m.income), expense: Math.round(m.expense), net: Math.round(m.net) })),
    yearly,
    velocity,
    forecast: forecastSeries(monthly).series,
  };
}
