"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Edit3, Pause, Play, Plus, Repeat, Sparkles, Trash2, TrendingUp, XCircle } from "lucide-react";
import { Async, Badge, Card, EmptyState, ListSkeleton, PageHeader, PageSkeleton, SectionTitle, statusTone } from "@/components/ui";
import { MonthCalendar, Chip } from "@/components/cards/Calendar";
import { ResourceForm, type FieldDef } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { TxnRow } from "@/components/cards";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { daysUntil, fmtDate, money, toInputDate } from "@/lib/format";
import { subMonthly } from "@/lib/client-utils";
import type { Subscription, TxnList } from "@/lib/types";

const FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "Netflix" },
  { key: "emoji", label: "Emoji", type: "text", placeholder: "🎬" },
  { key: "amount", label: "Amount", type: "number", required: true, min: 1 },
  { key: "cycle", label: "Billing cycle", type: "select", options: ["monthly", "yearly", "weekly"] },
  { key: "nextRenewal", label: "Next renewal", type: "date", required: true },
  { key: "lastUsedDays", label: "Days since last used", type: "number", min: 0, hint: "Used by AI to detect unused subscriptions" },
];

export function Subscriptions() {
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Subscription[]>("/api/resources/subscriptions");
  const [add, setAdd] = useState(false);
  const setStatus = async (s: Subscription, status: string) => {
    if (status === "cancelled" && !(await confirm({ title: `Cancel ${s.name}?`, message: "It will be marked as cancelled in your tracker. Remember to also cancel with the provider.", confirmText: "Mark cancelled", danger: true }))) return;
    await api.patch(`/api/resources/subscriptions/${s.id}`, { status });
    toast.success(`${s.name} ${status === "active" ? "resumed" : status}`);
    q.reload();
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" subtitle="Track renewals and cut waste" icon={Repeat} actions={<><Link href="/subscriptions/calendar" className="btn btn-secondary"><CalendarDays className="h-4 w-4" /> Renewals</Link><button className="btn btn-primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add</button></>} />
      <Async q={q} skeleton={<PageSkeleton cards={2} rows={4} />}>
        {(list) => {
          const active = list.filter((s) => s.status === "active");
          const monthly = active.reduce((a, s) => a + subMonthly(s), 0);
          const unused = active.filter((s) => s.lastUsedDays >= 30);
          const hikes = active.filter((s) => s.priceChangePct > 0);
          const sorted = [...list].sort((a, b) => +new Date(a.nextRenewal) - +new Date(b.nextRenewal));
          return (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-grad !border-0 text-white"><p className="text-sm opacity-80">Monthly Subscription Cost</p><p className="money mt-1 text-3xl font-bold">{money(monthly)}</p><p className="mt-1 text-xs opacity-80">{money(monthly * 12)} per year · {active.length} active</p></Card>
                <Card className="md:col-span-2">
                  <SectionTitle title="AI Detection" action={<Badge tone="violet"><Sparkles className="h-3 w-3" /> AI</Badge>} />
                  <ul className="space-y-2 text-sm">
                    {unused.length > 0 && <li className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> {unused.length} subscription{unused.length > 1 ? "s" : ""} may be unused ({unused.map((u) => u.name).join(", ")}) — save {money(unused.reduce((a, s) => a + subMonthly(s), 0) * 12)}/year</li>}
                    {hikes.map((h) => <li key={h.id} className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-rose-500" /> {h.name} price increased {h.priceChangePct}%</li>)}
                    {active.filter((s) => daysUntil(s.nextRenewal) <= 7).map((s) => <li key={s.id} className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-sky-500" /> {s.name} renews in {daysUntil(s.nextRenewal)} days ({money(s.amount)})</li>)}
                    {!unused.length && !hikes.length && <li className="text-slate-500">✓ Everything looks healthy.</li>}
                  </ul>
                </Card>
              </div>
              {list.length === 0 ? <EmptyState icon={Repeat} title="No subscriptions" body="Add your recurring services to track renewals." /> : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sorted.map((s) => {
                    const d = daysUntil(s.nextRenewal);
                    return (
                      <Card key={s.id} hover className={s.status !== "active" ? "opacity-70" : ""}>
                        <div className="flex items-center gap-4">
                          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl dark:bg-white/10">{s.emoji}</span>
                          <Link href={`/subscriptions/${s.id}`} className="min-w-0 flex-1">
                            <p className="font-semibold">{s.name}</p>
                            <p className="text-xs text-slate-500">{s.status === "active" ? `Renews ${fmtDate(s.nextRenewal)} (${d < 0 ? "overdue" : d === 0 ? "today" : `in ${d}d`})` : s.status}</p>
                            <div className="mt-1 flex gap-1.5">{s.lastUsedDays >= 30 && s.status === "active" && <Badge tone="amber">unused {s.lastUsedDays}d</Badge>}{s.priceChangePct > 0 && <Badge tone="red">+{s.priceChangePct}%</Badge>}</div>
                          </Link>
                          <div className="text-right"><p className="money text-lg font-bold">{money(s.amount)}</p><p className="text-xs text-slate-500">/{s.cycle === "monthly" ? "mo" : s.cycle === "yearly" ? "yr" : "wk"}</p></div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
                          {s.status === "active" ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus(s, "paused")}><Pause className="h-3.5 w-3.5" /> Pause</button> : s.status === "paused" ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus(s, "active")}><Play className="h-3.5 w-3.5" /> Resume</button> : null}
                          {s.status !== "cancelled" && <button className="btn btn-ghost btn-sm !text-rose-500" onClick={() => setStatus(s, "cancelled")}><XCircle className="h-3.5 w-3.5" /> Cancel</button>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          );
        }}
      </Async>
      <Modal open={add} onClose={() => setAdd(false)} title="Add subscription">
        <ResourceForm fields={FIELDS} initial={{ emoji: "🔄", nextRenewal: toInputDate(new Date(Date.now() + 30 * 86400000)), lastUsedDays: 0 }} submitLabel="Add subscription" onCancel={() => setAdd(false)} onSubmit={async (v) => { await api.post("/api/resources/subscriptions", { ...v, emoji: v.emoji || "🔄" }); toast.success("Subscription added"); setAdd(false); q.reload(); }} />
      </Modal>
    </div>
  );
}

export function SubscriptionDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Subscription>(`/api/resources/subscriptions/${id}`);
  const [edit, setEdit] = useState(false);
  const txns = useApi<TxnList>(q.data ? `/api/transactions?q=${encodeURIComponent(q.data.name.split(" ")[0])}&limit=8` : null);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={2} />}>
        {(s) => (
          <>
            <Card className="!p-6">
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-3xl dark:bg-white/10">{s.emoji}</span>
                <div className="flex-1"><h1 className="text-2xl font-bold">{s.name}</h1><Badge tone={statusTone(s.status)}>{s.status}</Badge></div>
                <div className="text-right"><p className="money text-3xl font-bold">{money(s.amount)}</p><p className="text-xs text-slate-500">per {s.cycle.replace("ly", "")}</p></div>
              </div>
              <dl className="mt-6 grid gap-5 sm:grid-cols-3">
                {[["Next renewal", fmtDate(s.nextRenewal)], ["Yearly cost", money(subMonthly(s) * 12)], ["Last used", s.lastUsedDays === 0 ? "Today" : `${s.lastUsedDays} days ago`], ["Price change", s.priceChangePct ? `+${s.priceChangePct}%` : "None"], ["Category", s.category], ["Started", fmtDate(s.createdAt)]].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
              </dl>
              {s.lastUsedDays >= 30 && s.status === "active" && <p className="mt-5 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /> Not used in {s.lastUsedDays} days — cancelling would save {money(subMonthly(s) * 12)}/year.</p>}
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</button>
                {s.status === "active" ? <button className="btn btn-secondary" onClick={async () => { q.setData(await api.patch<Subscription>(`/api/resources/subscriptions/${id}`, { status: "paused" })); toast.success("Paused"); }}><Pause className="h-4 w-4" /> Pause</button> : <button className="btn btn-secondary" onClick={async () => { q.setData(await api.patch<Subscription>(`/api/resources/subscriptions/${id}`, { status: "active" })); toast.success("Resumed"); }}><Play className="h-4 w-4" /> Resume</button>}
                <button className="btn btn-danger ml-auto" onClick={async () => { if (await confirm({ title: `Delete ${s.name}?`, confirmText: "Delete", danger: true })) { await api.del(`/api/resources/subscriptions/${id}`); toast.success("Deleted"); router.push("/subscriptions"); } }}><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </Card>
            <Card><SectionTitle title="Payment history" /><Async q={txns} skeleton={<ListSkeleton rows={3} h="h-12" />}>{(t) => t.items.length ? <div className="-mx-2">{t.items.map((x) => <TxnRow key={x.id} t={x} />)}</div> : <EmptyState title="No matching payments" />}</Async></Card>
            <Modal open={edit} onClose={() => setEdit(false)} title="Edit subscription">
              <ResourceForm fields={FIELDS} initial={{ ...s, nextRenewal: toInputDate(s.nextRenewal) }} onCancel={() => setEdit(false)} onSubmit={async (v) => { q.setData(await api.patch<Subscription>(`/api/resources/subscriptions/${id}`, v)); setEdit(false); toast.success("Saved"); }} />
            </Modal>
          </>
        )}
      </Async>
    </div>
  );
}

export function RenewalCalendar() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const q = useApi<Subscription[]>("/api/resources/subscriptions");
  const renewalsOn = (d: number) => (q.data ?? []).filter((s) => {
    if (s.status !== "active") return false;
    const n = new Date(s.nextRenewal);
    const cell = new Date(ym.y, ym.m, d);
    if (cell < new Date(n.getFullYear(), n.getMonth(), n.getDate())) return false;
    if (s.cycle === "monthly") return n.getDate() === d || (d === new Date(ym.y, ym.m + 1, 0).getDate() && n.getDate() > d);
    if (s.cycle === "yearly") return n.getMonth() === ym.m && n.getDate() === d;
    return Math.round((+cell - +new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000) % 7 === 0;
  });
  const monthTotal = Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => d <= new Date(ym.y, ym.m + 1, 0).getDate()).flatMap((d) => renewalsOn(d)).reduce((a, s) => a + s.amount, 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Renewal Calendar" subtitle="When each subscription charges you" icon={CalendarDays} />
      <Card className="!p-4"><p className="text-xs text-slate-500">Renewals this month</p><p className="money text-xl font-bold">{money(monthTotal)}</p></Card>
      <Card><Async q={q} skeleton={<ListSkeleton rows={5} h="h-16" />}>{() => <MonthCalendar year={ym.y} month={ym.m} onChange={(y, m) => setYm({ y, m })} render={(d) => renewalsOn(d).map((s) => <Chip key={s.id} color="#8b5cf6">{s.emoji} {s.name}</Chip>)} />}</Async></Card>
    </div>
  );
}
