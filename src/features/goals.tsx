"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, Flag, Minus, PiggyBank, Plus, Trash2, Trophy } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageHeader, PageSkeleton, ProgressBar } from "@/components/ui";
import { ScoreRing } from "@/components/charts";
import { ResourceForm, type FieldDef } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { cn, daysUntil, fmtDate, money, toInputDate } from "@/lib/format";
import type { Goal } from "@/lib/types";

const FIELDS: FieldDef[] = [
  { key: "name", label: "Goal name", type: "text", required: true, placeholder: "Emergency Fund", span: 2 },
  { key: "emoji", label: "Icon", type: "select", options: ["🎯", "🛟", "🏖️", "💻", "🏍️", "🏠", "🚗", "🎓", "💍", "📱"] },
  { key: "target", label: "Target amount", type: "number", required: true, min: 1 },
  { key: "saved", label: "Already saved", type: "number", min: 0 },
  { key: "deadline", label: "Target date", type: "date", required: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

const monthsLeft = (g: Goal) => Math.max(1, Math.round(daysUntil(g.deadline) / 30));
const needed = (g: Goal) => Math.max(0, Math.ceil((g.target - g.saved) / monthsLeft(g)));

function Contribute({ goal, dir, onClose, onDone }: { goal: Goal | null; dir: 1 | -1; onClose: () => void; onDone: (g: Goal) => void }) {
  const toast = useToast();
  return (
    <Modal open={!!goal} onClose={onClose} title={goal ? `${dir > 0 ? "Add to" : "Withdraw from"} ${goal.name}` : ""} size="sm">
      {goal && <ResourceForm fields={[{ key: "amount", label: "Amount", type: "number", required: true, min: 1, span: 2 }]} submitLabel={dir > 0 ? "Add funds" : "Withdraw"} onCancel={onClose} onSubmit={async (v) => {
        const amt = Number(v.amount);
        if (dir < 0 && amt > goal.saved) return toast.error("You can't withdraw more than you've saved");
        const row = await api.patch<Goal>(`/api/resources/goals/${goal.id}`, { saved: goal.saved + dir * amt });
        toast.success(dir > 0 && row.saved >= row.target ? "🎉 Goal reached!" : dir > 0 ? "Funds added" : "Withdrawn");
        onDone(row);
        onClose();
      }} />}
    </Modal>
  );
}

export function FinancialGoals() {
  const q = useApi<Goal[]>("/api/resources/goals");
  const [target, setTarget] = useState<Goal | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader title="Financial Goals" subtitle="Save for what matters" icon={Flag} actions={<Link href="/goals/new" className="btn btn-primary"><Plus className="h-4 w-4" /> New goal</Link>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={0} />}>
        {(list) => {
          const t = list.reduce((a, b) => a + b.target, 0);
          const s = list.reduce((a, b) => a + b.saved, 0);
          if (!list.length) return <EmptyState icon={Flag} title="No goals yet" body="Set a target and track your progress." action={<Link href="/goals/new" className="btn btn-primary">Create goal</Link>} />;
          return (
            <>
              <Card className="bg-grad !border-0 text-white"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm opacity-80">Total saved across goals</p><p className="money mt-1 text-3xl font-bold">{money(s)} <span className="text-lg font-normal opacity-70">/ {money(t)}</span></p></div><p className="text-2xl font-bold">{t ? Math.round((s / t) * 100) : 0}%</p></div><div className="mt-4 h-2.5 rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${t ? Math.min(100, (s / t) * 100) : 0}%` }} /></div></Card>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((g) => {
                const pct = Math.round((g.saved / g.target) * 100);
                const done = g.saved >= g.target;
                return (
                  <Card key={g.id} hover>
                    <div className="flex items-start gap-3"><span className="text-3xl">{g.emoji}</span><Link href={`/goals/${g.id}`} className="min-w-0 flex-1"><p className="font-semibold">{g.name}</p><p className="text-xs text-slate-500">by {fmtDate(g.deadline)}</p></Link>{done ? <Badge tone="green"><Trophy className="h-3 w-3" /> Done</Badge> : <Badge tone={daysUntil(g.deadline) < 0 ? "red" : "slate"}>{pct}%</Badge>}</div>
                    <p className="money mt-4 font-bold">{money(g.saved)} <span className="text-sm font-normal text-slate-500">/ {money(g.target)}</span></p>
                    <ProgressBar className="mt-2" value={g.saved} max={g.target} warn={false} color={done ? "#10b981" : undefined} />
                    <p className="mt-2 text-xs text-slate-500">{done ? "Goal reached 🎉" : daysUntil(g.deadline) < 0 ? "Past target date" : `Save ${money(needed(g))}/month to stay on track`}</p>
                    <button className="btn btn-secondary btn-sm mt-4 w-full" onClick={() => setTarget(g)}><PiggyBank className="h-4 w-4" /> Add funds</button>
                  </Card>
                );
              })}</div>
            </>
          );
        }}
      </Async>
      <Contribute goal={target} dir={1} onClose={() => setTarget(null)} onDone={() => q.reload()} />
    </div>
  );
}

export function CreateGoal() {
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Create Goal" subtitle="What are you saving for?" icon={Flag} />
      <Card className="!p-6"><ResourceForm fields={FIELDS} initial={{ emoji: "🎯", saved: 0, deadline: toInputDate(new Date(Date.now() + 180 * 86400000)) }} submitLabel="Create goal" onCancel={() => router.back()} onSubmit={async (v) => {
        if (Number(v.saved) > Number(v.target)) return toast.error("Saved amount can't exceed the target");
        const row = await api.post<Goal>("/api/resources/goals", { ...v, saved: v.saved || 0 });
        toast.success("Goal created");
        router.push(`/goals/${row.id}`);
      }} /></Card>
    </div>
  );
}

export function GoalDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Goal>(`/api/resources/goals/${id}`);
  const [dir, setDir] = useState<1 | -1>(1);
  const [contrib, setContrib] = useState(false);
  const [edit, setEdit] = useState(false);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={2} />}>
        {(g) => {
          const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
          return (
            <>
              <Card className="!p-6">
                <div className="grid items-center gap-6 sm:grid-cols-3">
                  <ScoreRing score={pct} size={170} label="complete" />
                  <div className="sm:col-span-2"><p className="text-3xl">{g.emoji}</p><h1 className="text-2xl font-bold">{g.name}</h1><p className="money mt-1 text-lg font-semibold">{money(g.saved)} <span className="text-sm font-normal text-slate-500">of {money(g.target)}</span></p>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">{[["Remaining", money(Math.max(0, g.target - g.saved))], ["Target date", fmtDate(g.deadline)], ["Days left", String(Math.max(0, daysUntil(g.deadline)))], ["Monthly needed", money(needed(g))]].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl></div>
                </div>
                {g.notes && <p className="mt-5 text-sm text-slate-500">{g.notes}</p>}
                <div className="mt-6 flex flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={() => { setDir(1); setContrib(true); }}><Plus className="h-4 w-4" /> Add funds</button>
                  <button className="btn btn-secondary" onClick={() => { setDir(-1); setContrib(true); }}><Minus className="h-4 w-4" /> Withdraw</button>
                  <button className="btn btn-secondary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</button>
                  <button className="btn btn-danger ml-auto" onClick={async () => { if (await confirm({ title: `Delete ${g.name}?`, confirmText: "Delete", danger: true })) { await api.del(`/api/resources/goals/${id}`); toast.success("Goal deleted"); router.push("/goals"); } }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
              <Card><p className="mb-4 font-semibold">Milestones</p><ol className="grid grid-cols-4 gap-2">{[25, 50, 75, 100].map((m) => { const hit = pct >= m; return <li key={m} className={cn("rounded-2xl border p-3 text-center", hit ? "border-emerald-300 bg-emerald-500/10" : "border-slate-200 dark:border-white/10")}><p className="text-xl">{hit ? "🏆" : "🔒"}</p><p className="text-sm font-semibold">{m}%</p><p className="text-[11px] text-slate-500">{money((g.target * m) / 100)}</p></li>; })}</ol></Card>
              <Contribute goal={contrib ? g : null} dir={dir} onClose={() => setContrib(false)} onDone={(row) => q.setData(row)} />
              <Modal open={edit} onClose={() => setEdit(false)} title="Edit goal"><ResourceForm fields={FIELDS} initial={{ ...g, deadline: toInputDate(g.deadline) }} onCancel={() => setEdit(false)} onSubmit={async (v) => { q.setData(await api.patch<Goal>(`/api/resources/goals/${id}`, v)); setEdit(false); toast.success("Saved"); }} /></Modal>
            </>
          );
        }}
      </Async>
    </div>
  );
}
