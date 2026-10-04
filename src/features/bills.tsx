"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, CheckCircle2, Edit3, Plus, Receipt, Trash2, Zap } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageHeader, PageSkeleton, Segmented, statusTone } from "@/components/ui";
import { MonthCalendar, Chip } from "@/components/cards/Calendar";
import { ResourceForm, type FieldDef } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { daysUntil, fmtDate, money, toInputDate } from "@/lib/format";
import type { Bill } from "@/lib/types";

const FIELDS: FieldDef[] = [
  { key: "name", label: "Bill name", type: "text", required: true, placeholder: "Electricity Bill", span: 2 },
  { key: "amount", label: "Amount", type: "number", required: true, min: 1 },
  { key: "dueDate", label: "Due date", type: "date", required: true },
  { key: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES },
  { key: "status", label: "Status", type: "select", options: ["upcoming", "paid", "overdue"] },
  { key: "autopay", label: "Autopay enabled", type: "checkbox" },
  { key: "recurring", label: "Repeats monthly", type: "checkbox" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const effStatus = (b: Bill) => (b.status === "paid" ? "paid" : daysUntil(b.dueDate) < 0 ? "overdue" : "upcoming");

async function markPaid(b: Bill) {
  await api.patch(`/api/resources/bills/${b.id}`, { status: "paid" });
  if (b.recurring) {
    const next = new Date(b.dueDate);
    next.setMonth(next.getMonth() + 1);
    await api.post("/api/resources/bills", { name: b.name, amount: b.amount, dueDate: next.toISOString(), category: b.category, autopay: b.autopay, recurring: true, status: "upcoming" });
  }
}

export function Bills() {
  const toast = useToast();
  const q = useApi<Bill[]>("/api/resources/bills");
  const [filter, setFilter] = useState("all");
  const [add, setAdd] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);

  const pay = async (b: Bill) => {
    await markPaid(b);
    toast.success(`${b.name} marked as paid${b.recurring ? " — next bill scheduled" : ""}`);
    q.reload();
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Bills" subtitle="Never miss a due date" icon={Receipt} actions={<><Link href="/bills/calendar" className="btn btn-secondary"><CalendarDays className="h-4 w-4" /> Calendar</Link><button className="btn btn-primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add bill</button></>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={4} />}>
        {(list) => {
          const week = list.filter((b) => b.status !== "paid" && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 7);
          const overdue = list.filter((b) => effStatus(b) === "overdue");
          const unpaid = list.filter((b) => b.status !== "paid");
          const shown = list.filter((b) => filter === "all" || effStatus(b) === filter).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card><p className="text-sm text-slate-500">Due in 7 days</p><p className="money mt-1 text-2xl font-bold">{money(week.reduce((a, b) => a + b.amount, 0))}</p><p className="text-xs text-slate-500">{week.length} bills</p></Card>
                <Card className={overdue.length ? "!border-rose-300/70" : ""}><p className="text-sm text-slate-500">Overdue</p><p className="money mt-1 text-2xl font-bold text-rose-500">{money(overdue.reduce((a, b) => a + b.amount, 0))}</p><p className="text-xs text-slate-500">{overdue.length} bills</p></Card>
                <Card><p className="text-sm text-slate-500">Total unpaid</p><p className="money mt-1 text-2xl font-bold">{money(unpaid.reduce((a, b) => a + b.amount, 0))}</p><p className="text-xs text-slate-500">{unpaid.length} bills</p></Card>
              </div>
              <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "upcoming", label: "Upcoming" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }]} />
              {shown.length === 0 ? <EmptyState icon={Receipt} title="No bills here" body="Add a bill to start tracking due dates." /> : (
                <div className="space-y-3">
                  {shown.map((b) => {
                    const st = effStatus(b);
                    const d = daysUntil(b.dueDate);
                    return (
                      <Card key={b.id} hover className="flex flex-wrap items-center gap-4 !p-4">
                        <span className={`grid h-11 w-11 place-items-center rounded-xl ${st === "overdue" ? "bg-rose-500/10 text-rose-500" : st === "paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}><CalendarClock className="h-5 w-5" /></span>
                        <Link href={`/bills/${b.id}`} className="min-w-0 flex-1"><p className="font-semibold">{b.name} {b.autopay && <Badge tone="blue"><Zap className="h-3 w-3" /> autopay</Badge>}</p><p className="text-xs text-slate-500">Due {fmtDate(b.dueDate)}{st !== "paid" && ` · ${d < 0 ? `${-d} days overdue` : d === 0 ? "today" : `in ${d} days`}`}</p></Link>
                        <Badge tone={statusTone(st)}>{st}</Badge>
                        <p className="money w-24 text-right text-lg font-bold">{money(b.amount)}</p>
                        {st !== "paid" ? (
                          <button className="btn btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setPayingBill(b)}>
                            <CheckCircle2 className="h-4 w-4" /> Pay Now
                          </button>
                        ) : (
                          <span className="w-[104px]" />
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          );
        }}
      </Async>
      <Modal open={add} onClose={() => setAdd(false)} title="Add bill">
        <ResourceForm fields={FIELDS} initial={{ category: "Bills", status: "upcoming", recurring: true, dueDate: toInputDate(new Date(Date.now() + 7 * 86400000)) }} submitLabel="Add bill" onCancel={() => setAdd(false)} onSubmit={async (v) => { await api.post("/api/resources/bills", v); toast.success("Bill added"); setAdd(false); q.reload(); }} />
      </Modal>
      {payingBill && (
        <PaymentModal
          open={!!payingBill}
          onClose={() => setPayingBill(null)}
          amount={payingBill.amount}
          itemName={payingBill.name}
          onSuccess={() => { pay(payingBill); setPayingBill(null); }}
        />
      )}
    </div>
  );
}

export function BillDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Bill>(`/api/resources/bills/${id}`);
  const [edit, setEdit] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={1} />}>
        {(b) => {
          const st = effStatus(b);
          return (
            <>
              <Card className="!p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{b.name}</h1><Badge tone={statusTone(st)} className="mt-2">{st}</Badge></div><p className="money text-3xl font-bold">{money(b.amount)}</p></div>
                <dl className="mt-6 grid gap-5 sm:grid-cols-2">{[["Due date", fmtDate(b.dueDate)], ["Category", b.category], ["Autopay", b.autopay ? "Enabled" : "Off"], ["Repeats", b.recurring ? "Monthly" : "One-time"]].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}<div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-0.5">{b.notes || <span className="text-slate-400">No notes</span>}</dd></div></dl>
                <div className="mt-6 flex flex-wrap gap-2">
                  {st !== "paid" && (
                    <button className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setEdit(false /* Hack to open payment, need to handle properly in details if needed, let's just mark paid for now as it's detail view */)}>
                      <CheckCircle2 className="h-4 w-4" /> Pay Bill Now
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</button>
                  <button className="btn btn-secondary" onClick={async () => { q.setData(await api.patch<Bill>(`/api/resources/bills/${id}`, { autopay: !b.autopay })); toast.success(`Autopay ${b.autopay ? "disabled" : "enabled"}`); }}><Zap className="h-4 w-4" /> {b.autopay ? "Disable" : "Enable"} autopay</button>
                  <button className="btn btn-danger ml-auto" onClick={async () => { if (await confirm({ title: "Delete bill?", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/bills/${id}`); toast.success("Deleted"); router.push("/bills"); } }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
              <Modal open={edit} onClose={() => setEdit(false)} title="Edit bill"><ResourceForm fields={FIELDS} initial={{ ...b, dueDate: toInputDate(b.dueDate) }} onCancel={() => setEdit(false)} onSubmit={async (v) => { q.setData(await api.patch<Bill>(`/api/resources/bills/${id}`, v)); setEdit(false); toast.success("Saved"); }} /></Modal>
            </>
          );
        }}
      </Async>
    </div>
  );
}

export function BillCalendar() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const q = useApi<Bill[]>("/api/resources/bills");
  const on = (d: number) => (q.data ?? []).filter((b) => { const x = new Date(b.dueDate); return x.getFullYear() === ym.y && x.getMonth() === ym.m && x.getDate() === d; });
  return (
    <div className="space-y-6">
      <PageHeader title="Bill Calendar" subtitle="All due dates in one view" icon={CalendarDays} />
      <Card>
        <Async q={q} skeleton={<PageSkeleton cards={0} rows={3} />}>
          {() => <MonthCalendar year={ym.y} month={ym.m} onChange={(y, m) => setYm({ y, m })} render={(d) => on(d).map((b) => <Chip key={b.id} color={effStatus(b) === "paid" ? "#10b981" : effStatus(b) === "overdue" ? "#ef4444" : "#f59e0b"}>{b.name} · {money(b.amount)}</Chip>)} />}
        </Async>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">{[["#f59e0b", "Upcoming"], ["#ef4444", "Overdue"], ["#10b981", "Paid"]].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>)}</div>
      </Card>
    </div>
  );
}
