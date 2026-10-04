import type { NextRequest } from "next/server";
import { like as ilike, or, desc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { route } from "@/lib/api";
import { money, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return { results: [] };
  const like = `%${q}%`;
  const [tx, subs, bills, invs, goals, groups, scans] = await Promise.all([
    db.select().from(s.transactions).where(or(ilike(s.transactions.merchant, like), ilike(s.transactions.category, like), ilike(s.transactions.notes, like))).orderBy(desc(s.transactions.date)).limit(8),
    db.select().from(s.subscriptions).where(ilike(s.subscriptions.name, like)).limit(4),
    db.select().from(s.bills).where(ilike(s.bills.name, like)).limit(4),
    db.select().from(s.invoices).where(or(ilike(s.invoices.party, like), ilike(s.invoices.number, like))).limit(4),
    db.select().from(s.goals).where(ilike(s.goals.name, like)).limit(4),
    db.select().from(s.groups).where(ilike(s.groups.name, like)).limit(4),
    db.select().from(s.scans).where(or(ilike(s.scans.merchant, like), ilike(s.scans.fileName, like))).orderBy(desc(s.scans.id)).limit(4),
  ]);
  const results = [
    ...tx.map((t) => ({ type: t.type === "income" ? "Income" : "Expense", id: t.id, title: t.merchant, subtitle: `${t.category} · ${fmtDate(t.date)}`, amount: t.type === "income" ? t.amount : -t.amount, href: `/${t.type === "income" ? "income" : "expenses"}/${t.id}` })),
    ...subs.map((x) => ({ type: "Subscription", id: x.id, title: x.name, subtitle: `${money(x.amount)}/${x.cycle}`, href: `/subscriptions/${x.id}` })),
    ...bills.map((x) => ({ type: "Bill", id: x.id, title: x.name, subtitle: `Due ${fmtDate(x.dueDate)} · ${x.status}`, href: `/bills/${x.id}` })),
    ...invs.map((x) => ({ type: "Invoice", id: x.id, title: `${x.number} · ${x.party}`, subtitle: x.status, href: `/invoices/${x.id}` })),
    ...goals.map((x) => ({ type: "Goal", id: x.id, title: x.name, subtitle: `${money(x.saved)} / ${money(x.target)}`, href: `/goals/${x.id}` })),
    ...groups.map((x) => ({ type: "Group", id: x.id, title: x.name, subtitle: `${x.members.length} members`, href: "/shared/groups" })),
    ...scans.map((x) => ({ type: "Scan", id: x.id, title: `${x.merchant} (${x.fileName})`, subtitle: `${money(x.total)} · ${x.confidence}% confidence`, href: `/scanner/result/${x.id}` })),
  ];
  return { results };
});
