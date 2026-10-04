import type { NextRequest } from "next/server";
import { and, asc, count, desc, eq, gte, like as ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { assessRisk } from "@/lib/risk";
import { applyBalance } from "@/lib/balance";
import { logActivity, notify } from "@/lib/log";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const p = req.nextUrl.searchParams;
  const conds: (SQL | undefined)[] = [];
  const type = p.get("type");
  if (type) conds.push(eq(transactions.type, type));
  const cat = p.get("category");
  if (cat) conds.push(inArray(transactions.category, cat.split(",")));
  const pay = p.get("payment");
  if (pay) conds.push(inArray(transactions.paymentMethod, pay.split(",")));
  const risk = p.get("risk");
  if (risk) conds.push(inArray(transactions.risk, risk.split(",")));
  const source = p.get("source");
  if (source) conds.push(eq(transactions.source, source));
  const accountId = p.get("accountId");
  if (accountId) conds.push(eq(transactions.accountId, Number(accountId)));
  if (p.get("recurring") === "1") conds.push(eq(transactions.recurring, true));
  const q = p.get("q");
  if (q) conds.push(or(ilike(transactions.merchant, `%${q}%`), ilike(transactions.notes, `%${q}%`), ilike(transactions.category, `%${q}%`)));
  const from = p.get("from");
  if (from) conds.push(gte(transactions.date, new Date(from)));
  const to = p.get("to");
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    conds.push(lte(transactions.date, t));
  }
  const min = p.get("min");
  if (min) conds.push(gte(transactions.amount, Number(min)));
  const max = p.get("max");
  if (max) conds.push(lte(transactions.amount, Number(max)));

  const sortMap = { date: transactions.date, amount: transactions.amount, merchant: transactions.merchant, category: transactions.category } as const;
  const sortKey = (p.get("sort") ?? "date") as keyof typeof sortMap;
  const col = sortMap[sortKey] ?? transactions.date;
  const order = p.get("dir") === "asc" ? asc(col) : desc(col);
  const page = Math.max(1, Number(p.get("page") ?? 1));
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") ?? 20)));
  const where = conds.length ? and(...conds) : undefined;

  const [items, [agg]] = await Promise.all([
    db.select().from(transactions).where(where).orderBy(order, desc(transactions.id)).limit(limit).offset((page - 1) * limit),
    db.select({ n: count(), total: sql<number>`coalesce(sum(${transactions.amount}),0)` }).from(transactions).where(where),
  ]);
  return { items, total: agg.n, page, limit, sum: Number(agg.total) };
});

export const POST = route(async (req: NextRequest) => {
  const b = await req.json();
  const amount = Number(b.amount);
  if (!b.merchant || !String(b.merchant).trim()) return bad("Merchant / source is required");
  if (!amount || amount <= 0) return bad("Amount must be greater than 0");
  const type = b.type === "income" ? "income" : "expense";
  const date = b.date ? new Date(b.date) : new Date();
  if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) date.setHours(12, 0, 0, 0);
  const category = b.category || (type === "income" ? "Salary" : "Other");
  const history = await db.select().from(transactions);
  const { risk, reason } = assessRisk({ merchant: String(b.merchant), category, amount, date, type }, history);
  const values = {
    type,
    merchant: String(b.merchant).trim(),
    category,
    amount,
    tax: Number(b.tax) || 0,
    date,
    paymentMethod: b.paymentMethod || "UPI",
    accountId: b.accountId ? Number(b.accountId) : null,
    notes: b.notes ?? "",
    source: b.source ?? "manual",
    recurring: !!b.recurring,
    risk,
    riskReason: reason,
  };
  const [row] = await db.insert(transactions).values(values).$returningId();
  const created = { ...row, ...values, createdAt: new Date() };
  await applyBalance(created.accountId, created.type, created.amount, 1);
  await logActivity(type === "income" ? "Income added" : "Expense added", `${created.merchant} ${money(created.amount)}`);
  if (risk !== "low") await notify(`${risk === "high" ? "High-risk" : "Suspicious"} transaction flagged`, `${created.merchant} ${money(created.amount)}: ${reason}`, "alert");
  return created;
});
