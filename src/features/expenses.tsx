"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard, Edit3, Layers, Repeat, ScanLine, ShieldAlert, Trash2, Copy, Wallet } from "lucide-react";
import { Async, Badge, Card, CatIcon, EmptyState, PageHeader, PageSkeleton, ProgressBar, SectionTitle, DeltaChip, ListSkeleton, Segmented } from "@/components/ui";
import { TransactionExplorer } from "@/components/tables/TransactionExplorer";
import { TransactionForm } from "@/components/forms";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { EXPENSE_CATEGORIES, catMeta } from "@/lib/constants";
import { cn, fmtDate, money, toInputDate } from "@/lib/format";
import type { Account, Budget, Stats, Txn, TxnList } from "@/lib/types";

export function ExpensesPage() {
  const stats = useApi<Stats>("/api/stats?range=30d");
  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" subtitle="Search, filter and manage every transaction" icon={CreditCard} actions={<><Link href="/scanner" className="btn btn-secondary"><ScanLine className="h-4 w-4" /> Scan</Link><Link href="/expenses/recurring" className="btn btn-secondary"><Repeat className="h-4 w-4" /> Recurring</Link></>} />
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Spent (30d)", money(stats.data.totals.expense)],
            ["Transactions", String(stats.data.totals.count)],
            ["Avg. transaction", money(stats.data.totals.avg)],
            ["Largest", stats.data.totals.largest ? money(stats.data.totals.largest.amount) : "—"],
          ].map(([l, v]) => (
            <Card key={l} className="!p-4"><p className="text-xs text-slate-500">{l}</p><p className="money mt-1 text-lg font-bold">{v}</p></Card>
          ))}
        </div>
      )}
      <TransactionExplorer type="expense" />
    </div>
  );
}

export function AddTransactionPage({ type }: { type: "expense" | "income" }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={type === "income" ? "Add Income" : "Add Expense"} subtitle={type === "income" ? "Record money coming in" : "Log a purchase manually — or scan a receipt for instant entry"} icon={type === "income" ? Wallet : CreditCard} actions={type === "expense" ? <Link href="/scanner" className="btn btn-secondary"><ScanLine className="h-4 w-4" /> Scan instead</Link> : undefined} />
      <Card className="!p-6"><TransactionForm type={type} /></Card>
    </div>
  );
}

export function TransactionDetails({ type, id }: { type: "expense" | "income"; id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Txn>(`/api/transactions/${id}`);
  const accounts = useApi<Account[]>("/api/resources/accounts");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("edit") === "1") setEditing(true);
  }, []);
  const listHref = type === "income" ? "/income" : "/expenses";

  const patch = async (data: Partial<Txn>, msg: string) => {
    try {
      const row = await api.patch<Txn>(`/api/transactions/${id}`, data);
      q.setData(row);
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };
  const del = async (t: Txn) => {
    if (!(await confirm({ title: "Delete this transaction?", message: `${t.merchant} · ${money(t.amount)} will be permanently removed.`, confirmText: "Delete", danger: true }))) return;
    try {
      await api.del(`/api/transactions/${id}`);
      toast.success("Transaction deleted");
      router.push(listHref);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };
  const duplicate = async (t: Txn) => {
    try {
      const row = await api.post<Txn>("/api/transactions", { ...t, date: toInputDate(new Date()), source: "manual" });
      toast.success("Duplicated with today's date");
      router.push(`${listHref}/${row.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={3} />}>
        {(t) => {
          const flagged = t.risk !== "low" || t.riskReason.startsWith("Duplicate");
          const acct = accounts.data?.find((a) => a.id === t.accountId);
          if (editing)
            return (
              <>
                <PageHeader title="Edit transaction" icon={Edit3} />
                <Card className="!p-6"><TransactionForm type={t.type === "income" ? "income" : "expense"} initial={t} onSaved={(row) => { q.setData(row); setEditing(false); }} onCancel={() => setEditing(false)} /></Card>
              </>
            );
          return (
            <div className="space-y-5">
              <Card className="!p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <CatIcon name={t.category} size="lg" />
                    <div>
                      <h1 className="text-2xl font-bold">{t.merchant}</h1>
                      <p className="text-sm text-slate-500">{t.category} · {fmtDate(t.date)}</p>
                    </div>
                  </div>
                  <p className={cn("money text-3xl font-bold tabular-nums", t.type === "income" && "text-emerald-600 dark:text-emerald-400")}>{money(t.type === "income" ? t.amount : -t.amount, { sign: true })}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {t.recurring && <Badge tone="violet"><Repeat className="h-3 w-3" /> Recurring</Badge>}
                  {t.source === "scan" && <Badge tone="blue"><ScanLine className="h-3 w-3" /> Scanned</Badge>}
                  <Badge tone={t.risk === "high" ? "red" : t.risk === "medium" ? "amber" : "green"}>{t.risk} risk</Badge>
                </div>
                <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {[
                    ["Payment method", t.paymentMethod],
                    ["Account", acct ? `${acct.name}${acct.last4 ? ` ••${acct.last4}` : ""}` : "—"],
                    ["Tax / GST", t.tax ? money(t.tax) : "—"],
                    ["Source", t.source],
                    ["Date", fmtDate(t.date)],
                    ["Added", fmtDate(t.createdAt)],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 font-medium capitalize">{v}</dd></div>
                  ))}
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-0.5">{t.notes || <span className="text-slate-400">No notes</span>}</dd></div>
                </dl>
              </Card>

              {flagged && (
                <Card className="border-amber-300/60 !bg-amber-50/70 dark:!border-amber-500/30 dark:!bg-amber-500/10">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <p className="font-semibold">AI flagged this transaction</p>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{t.riskReason || "Unusual pattern detected."}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => patch({ risk: "low", riskReason: "Reviewed: marked safe" }, "Marked as safe")}><CheckCircle2 className="h-4 w-4" /> This was me</button>
                        <button className="btn btn-danger btn-sm" onClick={() => patch({ risk: "high", riskReason: "Reported as fraud by user" }, "Reported — we've flagged this transaction")}><AlertTriangle className="h-4 w-4" /> Report fraud</button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => setEditing(true)}><Edit3 className="h-4 w-4" /> Edit</button>
                <button className="btn btn-secondary" onClick={() => duplicate(t)}><Copy className="h-4 w-4" /> Duplicate</button>
                <button className="btn btn-secondary" onClick={() => patch({ recurring: !t.recurring }, t.recurring ? "Removed from recurring" : "Marked as recurring")}><Repeat className="h-4 w-4" /> {t.recurring ? "Unmark recurring" : "Mark recurring"}</button>
                <button className="btn btn-danger ml-auto" onClick={() => del(t)}><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </div>
          );
        }}
      </Async>
    </div>
  );
}

const RECURRING = { recurring: "1" };

export function RecurringExpenses() {
  const q = useApi<TxnList>("/api/transactions?type=expense&recurring=1&limit=200");
  const groups = useMemo(() => {
    const m = new Map<string, { merchant: string; category: string; amount: number; count: number; last: string }>();
    for (const t of q.data?.items ?? []) {
      const g = m.get(t.merchant);
      if (!g) m.set(t.merchant, { merchant: t.merchant, category: t.category, amount: t.amount, count: 1, last: t.date });
      else g.count++;
    }
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }, [q.data]);
  const nextOf = (iso: string) => {
    const d = new Date(iso);
    d.setMonth(d.getMonth() + 1);
    while (d < new Date()) d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Recurring Expenses" subtitle="Detected repeating charges and their next expected date" icon={Repeat} />
      <Async q={q} skeleton={<ListSkeleton rows={4} h="h-24" />}>
        {() => groups.length === 0 ? <EmptyState icon={Repeat} title="No recurring expenses yet" body="Mark any expense as recurring and it will show up here." /> : (
          <>
            <Card className="!p-5">
              <p className="text-sm text-slate-500">Estimated monthly recurring cost</p>
              <p className="money mt-1 text-3xl font-bold">{money(groups.reduce((a, g) => a + g.amount, 0))}</p>
              <p className="text-xs text-slate-500">{groups.length} recurring merchants</p>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => (
                <Card key={g.merchant} hover className="flex items-center gap-4">
                  <CatIcon name={g.category} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{g.merchant}</p>
                    <p className="text-xs text-slate-500">{g.count} charges · next ≈ {fmtDate(nextOf(g.last))}</p>
                  </div>
                  <p className="money font-bold">{money(g.amount)}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </Async>
      <div>
        <SectionTitle title="All recurring transactions" />
        <TransactionExplorer type="expense" extra={RECURRING} hideAdd />
      </div>
    </div>
  );
}

export function ExpenseCategories() {
  const [range, setRange] = useState("3m");
  const stats = useApi<Stats>(`/api/stats?range=${range}`);
  const budgets = useApi<Budget[]>("/api/resources/budgets");
  return (
    <div className="space-y-6">
      <PageHeader title="Expense Categories" subtitle="Where your money goes, by category" icon={Layers} actions={<Segmented size="sm" value={range} onChange={setRange} options={[{ value: "30d", label: "30D" }, { value: "3m", label: "3M" }, { value: "6m", label: "6M" }, { value: "1y", label: "1Y" }]} />} />
      <Async q={stats} skeleton={<PageSkeleton cards={3} rows={0} />}>
        {(s) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EXPENSE_CATEGORIES.map((name) => {
              const c = s.categories.find((x) => x.name === name);
              const budget = budgets.data?.find((b) => b.category === name);
              const months = Math.max(1, s.range.days / 30);
              const delta = c && c.prev > 0 ? ((c.value - c.prev) / c.prev) * 100 : null;
              return (
                <Card key={name} hover>
                  <div className="flex items-center gap-3">
                    <CatIcon name={name} size="lg" />
                    <div className="flex-1"><p className="font-semibold">{name}</p><p className="text-xs text-slate-500">{c?.count ?? 0} transactions</p></div>
                    {delta !== null && <DeltaChip value={delta} goodWhenDown />}
                  </div>
                  <p className="money mt-4 text-2xl font-bold">{money(c?.value ?? 0)}</p>
                  <p className="text-xs text-slate-500">{c ? c.pct.toFixed(1) : 0}% of spending · avg {money(c ? c.value / Math.max(1, c.count) : 0)}</p>
                  {budget ? (
                    <div className="mt-3">
                      <ProgressBar value={(c?.value ?? 0) / months} max={budget.limitAmount} color={catMeta(name).color} />
                      <p className="mt-1 text-xs text-slate-500">≈ {money((c?.value ?? 0) / months)}/mo of {money(budget.limitAmount)} budget</p>
                    </div>
                  ) : <Link href="/budgets/new" className="mt-3 inline-block text-xs font-medium text-indigo-500">Set a budget →</Link>}
                </Card>
              );
            })}
          </div>
        )}
      </Async>
    </div>
  );
}
