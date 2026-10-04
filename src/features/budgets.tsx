"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Edit3, Plus, Sparkles, Target, Trash2, Loader2 } from "lucide-react";
import { Async, Badge, Card, CatIcon, EmptyState, PageHeader, PageSkeleton, ProgressBar, SectionTitle, Skeleton } from "@/components/ui";
import { SpendingChart } from "@/components/charts";
import { MonthCalendar, Chip } from "@/components/cards/Calendar";
import { ResourceForm } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { TxnRow } from "@/components/cards";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { EXPENSE_CATEGORIES, catMeta } from "@/lib/constants";
import { cn, money, toInputDate } from "@/lib/format";
import type { Budget, Stats, TxnList } from "@/lib/types";

function monthRange() {
  const n = new Date();
  return { from: toInputDate(new Date(n.getFullYear(), n.getMonth(), 1)), to: toInputDate(n), daysLeft: new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate() };
}
const mStats = () => {
  const r = monthRange();
  return `/api/stats?range=custom&from=${r.from}&to=${r.to}`;
};

export function Budgets() {
  const toast = useToast();
  const confirm = useConfirm();
  const budgets = useApi<Budget[]>("/api/resources/budgets");
  const stats = useApi<Stats>(mStats());
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Budget | null>(null);

  const smart = async () => {
    if (!(await confirm({ title: "Generate smart budget?", message: "AI will replace your current budgets with limits based on your last 3 months of spending (with a 5% savings stretch).", confirmText: "Generate" }))) return;
    setBusy(true);
    try {
      await api.post("/api/budgets/smart");
      toast.success("Smart budget generated ✨");
      budgets.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  };
  const remove = async (b: Budget) => {
    if (!(await confirm({ title: `Delete ${b.category} budget?`, confirmText: "Delete", danger: true }))) return;
    await api.del(`/api/resources/budgets/${b.id}`);
    toast.success("Budget deleted");
    budgets.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" subtitle="Stay on track every month" icon={Target} actions={<><Link href="/budgets/calendar" className="btn btn-secondary"><CalendarDays className="h-4 w-4" /> Calendar</Link><button className="btn btn-secondary" onClick={smart} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-violet-500" />} Generate Smart Budget</button><Link href="/budgets/new" className="btn btn-primary"><Plus className="h-4 w-4" /> New</Link></>} />
      <Async q={budgets} skeleton={<PageSkeleton cards={1} rows={4} />}>
        {(list) => {
          const overall = list.find((b) => b.category === "Overall");
          const spentOf = (c: string) => stats.data?.categories.find((x) => x.name === c)?.value ?? 0;
          const total = stats.data?.totals.expense ?? 0;
          const cats = list.filter((b) => b.category !== "Overall");
          if (!list.length) return <EmptyState icon={Target} title="No budgets yet" body="Create one manually or let AI build a smart budget from your spending." action={<button className="btn btn-primary" onClick={smart}><Sparkles className="h-4 w-4" /> Generate Smart Budget</button>} />;
          return (
            <>
              {overall && (
                <Card className="!p-6">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div><p className="text-sm text-slate-500">Monthly Budget</p><p className="money mt-1 text-3xl font-bold">{money(total)} <span className="text-lg font-normal text-slate-400">/ {money(overall.limitAmount)}</span></p></div>
                    <div className="flex items-center gap-2"><Badge tone={total > overall.limitAmount ? "red" : "green"}>{Math.round((total / overall.limitAmount) * 100)}% used</Badge><button className="btn btn-ghost btn-sm" onClick={() => setEdit(overall)} aria-label="Edit overall budget"><Edit3 className="h-4 w-4" /></button></div>
                  </div>
                  <ProgressBar className="mt-4 !h-4" value={total} max={overall.limitAmount} />
                  <p className="mt-2 text-xs text-slate-500">{total > overall.limitAmount ? `${money(total - overall.limitAmount)} over budget` : `${money(overall.limitAmount - total)} left · ${money((overall.limitAmount - total) / Math.max(1, monthRange().daysLeft))}/day safe to spend`}</p>
                </Card>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {cats.map((b) => {
                  const s = spentOf(b.category);
                  const over = s > b.limitAmount;
                  return (
                    <Card key={b.id} hover className={cn(over && "!border-rose-300/70 dark:!border-rose-500/30")}>
                      <div className="flex items-center gap-3">
                        <CatIcon name={b.category} />
                        <Link href={`/budgets/${b.id}`} className="min-w-0 flex-1"><p className="font-semibold">{b.category}</p><p className="money text-sm text-slate-500">{money(s)} / {money(b.limitAmount)}</p></Link>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(b)} aria-label={`Edit ${b.category}`}><Edit3 className="h-4 w-4" /></button>
                        <button className="btn btn-ghost btn-sm !text-rose-500" onClick={() => remove(b)} aria-label={`Delete ${b.category}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <ProgressBar className="mt-4" value={s} max={b.limitAmount} color={catMeta(b.category).color} />
                      <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">{Math.round((s / b.limitAmount) * 100)}%</span>{over ? <span className="flex items-center gap-1 font-semibold text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> Over Budget by {money(s - b.limitAmount)}</span> : <span className="text-slate-500">{money(b.limitAmount - s)} left</span>}</div>
                    </Card>
                  );
                })}
              </div>
            </>
          );
        }}
      </Async>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.category ?? ""} budget`} size="sm">
        {edit && <ResourceForm fields={[{ key: "limitAmount", label: "Monthly limit", type: "number", required: true, min: 1, span: 2 }]} initial={{ limitAmount: edit.limitAmount }} onCancel={() => setEdit(null)} onSubmit={async (v) => { await api.patch(`/api/resources/budgets/${edit.id}`, v); toast.success("Budget updated"); setEdit(null); budgets.reload(); }} />}
      </Modal>
    </div>
  );
}

export function CreateBudget() {
  const router = useRouter();
  const toast = useToast();
  const budgets = useApi<Budget[]>("/api/resources/budgets");
  const stats = useApi<Stats>("/api/stats?range=3m");
  const [cat, setCat] = useState("Food");
  const suggestion = useMemo(() => {
    if (!stats.data) return null;
    if (cat === "Overall") return Math.round(stats.data.totals.expense / 3 / 500) * 500;
    const c = stats.data.categories.find((x) => x.name === cat);
    return c ? Math.round(c.value / 3 / 100) * 100 : null;
  }, [stats.data, cat]);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Create Budget" subtitle="Set a monthly spending limit" icon={Target} />
      <Card className="!p-6">
        <div className="mb-4"><label className="label">Category</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{["Overall", ...EXPENSE_CATEGORIES].map((c) => <option key={c}>{c}</option>)}</select></div>
        {suggestion ? <p className="mb-4 flex items-center gap-2 rounded-xl bg-violet-500/10 p-3 text-sm text-violet-700 dark:text-violet-300"><Sparkles className="h-4 w-4" /> AI suggestion: <b>{money(suggestion)}</b>/month (your 3-month average)</p> : null}
        <ResourceForm
          key={cat + suggestion}
          fields={[{ key: "limitAmount", label: "Monthly limit", type: "number", required: true, min: 1, span: 2 }]}
          initial={{ limitAmount: suggestion ?? "" }}
          submitLabel="Create budget"
          onCancel={() => router.back()}
          onSubmit={async (v) => {
            if (budgets.data?.some((b) => b.category === cat)) return toast.error(`A budget for ${cat} already exists — edit it from the Budgets page.`);
            await api.post("/api/resources/budgets", { category: cat, limitAmount: v.limitAmount, period: "monthly" });
            toast.success("Budget created");
            router.push("/budgets");
          }}
        />
      </Card>
    </div>
  );
}

export function BudgetDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const b = useApi<Budget>(`/api/resources/budgets/${id}`);
  const r = monthRange();
  const cat = b.data?.category;
  const stats = useApi<Stats>(cat ? `/api/stats?range=custom&from=${r.from}&to=${r.to}` : null);
  const txns = useApi<TxnList>(cat ? `/api/transactions?type=expense&from=${r.from}&to=${r.to}&limit=100${cat !== "Overall" ? `&category=${encodeURIComponent(cat)}` : ""}` : null);
  const [edit, setEdit] = useState(false);
  return (
    <div className="space-y-6">
      <Async q={b} skeleton={<PageSkeleton cards={1} rows={3} />}>
        {(bud) => {
          const spent = bud.category === "Overall" ? (stats.data?.totals.expense ?? 0) : (stats.data?.categories.find((c) => c.name === bud.category)?.value ?? 0);
          const left = bud.limitAmount - spent;
          let acc = 0;
          const days = (() => {
            const map = new Map<string, number>();
            for (const t of txns.data?.items ?? []) map.set(t.date.slice(0, 10), (map.get(t.date.slice(0, 10)) ?? 0) + t.amount);
            return [...map.entries()].sort().map(([d, v]) => ({ label: new Date(d).getDate() + "", expense: (acc += v), income: bud.limitAmount }));
          })();
          return (
            <>
              <PageHeader title={`${bud.category} Budget`} subtitle={`${money(bud.limitAmount)} per month`} icon={Target} actions={<><button className="btn btn-secondary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</button><button className="btn btn-danger" onClick={async () => { if (await confirm({ title: "Delete budget?", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/budgets/${id}`); toast.success("Deleted"); router.push("/budgets"); } }}><Trash2 className="h-4 w-4" /></button></>} />
              <div className="grid gap-4 sm:grid-cols-4">
                {[["Spent", money(spent)], ["Limit", money(bud.limitAmount)], [left >= 0 ? "Remaining" : "Over by", money(Math.abs(left))], ["Safe daily spend", left > 0 ? money(left / Math.max(1, r.daysLeft)) : "—"]].map(([l, v]) => <Card key={l} className="!p-4"><p className="text-xs text-slate-500">{l}</p><p className={cn("money mt-1 text-xl font-bold", l === "Over by" && "text-rose-500")}>{v}</p></Card>)}
              </div>
              <Card><ProgressBar className="!h-4" value={spent} max={bud.limitAmount} /><p className="mt-2 text-xs text-slate-500">{Math.round((spent / bud.limitAmount) * 100)}% of budget used · {r.daysLeft} days left this month</p></Card>
              <Card><SectionTitle title="Cumulative spend this month" sub="Purple: cumulative spend · Green: budget limit" />{days.length ? <SpendingChart data={days} height={240} /> : <Skeleton className="h-60" />}</Card>
              <Card><SectionTitle title="Transactions this month" /><Async q={txns} skeleton={<Skeleton className="h-40" />}>{(t) => t.items.length ? <div className="-mx-2">{t.items.slice(0, 15).map((x) => <TxnRow key={x.id} t={x} />)}</div> : <EmptyState title="No spending yet this month" />}</Async></Card>
              <Modal open={edit} onClose={() => setEdit(false)} title="Edit limit" size="sm"><ResourceForm fields={[{ key: "limitAmount", label: "Monthly limit", type: "number", required: true, min: 1, span: 2 }]} initial={{ limitAmount: bud.limitAmount }} onCancel={() => setEdit(false)} onSubmit={async (v) => { const row = await api.patch<Budget>(`/api/resources/budgets/${id}`, v); b.setData(row); setEdit(false); toast.success("Budget updated"); }} /></Modal>
            </>
          );
        }}
      </Async>
    </div>
  );
}

export function BudgetCalendar() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const from = toInputDate(new Date(ym.y, ym.m, 1));
  const to = toInputDate(new Date(ym.y, ym.m + 1, 0));
  const txns = useApi<TxnList>(`/api/transactions?type=expense&from=${from}&to=${to}&limit=200`);
  const budgets = useApi<Budget[]>("/api/resources/budgets");
  const dim = new Date(ym.y, ym.m + 1, 0).getDate();
  const overall = budgets.data?.find((b) => b.category === "Overall")?.limitAmount ?? 0;
  const allowance = overall / dim;
  const byDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of txns.data?.items ?? []) m.set(new Date(t.date).getDate(), (m.get(new Date(t.date).getDate()) ?? 0) + t.amount);
    return m;
  }, [txns.data]);
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Budget Calendar" subtitle="Daily spending against your daily allowance" icon={CalendarDays} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="!p-4"><p className="text-xs text-slate-500">Spent this month</p><p className="money mt-1 text-xl font-bold">{money(total)}</p></Card>
        <Card className="!p-4"><p className="text-xs text-slate-500">Daily allowance</p><p className="money mt-1 text-xl font-bold">{money(allowance)}</p></Card>
        <Card className="!p-4"><p className="text-xs text-slate-500">Days over allowance</p><p className="mt-1 text-xl font-bold text-rose-500">{[...byDay.values()].filter((v) => v > allowance).length}</p></Card>
      </div>
      <Card>
        <MonthCalendar year={ym.y} month={ym.m} onChange={(y, m) => setYm({ y, m })} render={(d) => {
          const v = byDay.get(d);
          if (!v) return null;
          return <Chip color={v > allowance * 1.5 ? "#ef4444" : v > allowance ? "#f59e0b" : "#10b981"}>{money(v)}</Chip>;
        }} />
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          {[["#10b981", "Within allowance"], ["#f59e0b", "Over allowance"], ["#ef4444", "50%+ over"]].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
        </div>
      </Card>
    </div>
  );
}
