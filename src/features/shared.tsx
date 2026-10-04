"use client";
import { useMemo, useState } from "react";
import { ArrowRight, HandCoins, Plus, Receipt, Trash2, Users } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { Field } from "@/components/forms";
import { ResourceForm } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { cn, fmtDate, money, toInputDate } from "@/lib/format";
import type { Group, Settlement, SharedExpense } from "@/lib/types";

function balances(g: Group, ex: SharedExpense[], st: Settlement[]) {
  const net: Record<string, number> = Object.fromEntries(g.members.map((m) => [m, 0]));
  for (const e of ex.filter((x) => x.groupId === g.id)) {
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.amount;
    const share = e.amount / (e.splitWith.length || 1);
    for (const m of e.splitWith) net[m] = (net[m] ?? 0) - share;
  }
  for (const s of st.filter((x) => x.groupId === g.id)) {
    net[s.fromUser] = (net[s.fromUser] ?? 0) + s.amount;
    net[s.toUser] = (net[s.toUser] ?? 0) - s.amount;
  }
  return net;
}

function simplify(net: Record<string, number>) {
  const debt = Object.entries(net).filter(([, v]) => v < -0.5).map(([k, v]) => ({ k, v: -v })).sort((a, b) => b.v - a.v);
  const cred = Object.entries(net).filter(([, v]) => v > 0.5).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    out.push({ from: debt[i].k, to: cred[j].k, amount: Math.round(amt) });
    debt[i].v -= amt;
    cred[j].v -= amt;
    if (debt[i].v < 0.5) i++;
    if (cred[j].v < 0.5) j++;
  }
  return out;
}

function useShared() {
  const groups = useApi<Group[]>("/api/resources/groups");
  const expenses = useApi<SharedExpense[]>("/api/resources/shared-expenses");
  const settlements = useApi<Settlement[]>("/api/resources/settlements");
  const reload = async () => {
    await Promise.all([groups.reload(), expenses.reload(), settlements.reload()]);
  };
  const ready = groups.data && expenses.data && settlements.data;
  const error = groups.error ?? expenses.error ?? settlements.error;
  return { groups, expenses, settlements, reload, ready, error, bundle: { data: ready ? { g: groups.data!, e: expenses.data!, s: settlements.data! } : null, error, reload } };
}

function Avatars({ members }: { members: string[] }) {
  return <div className="flex -space-x-2">{members.slice(0, 5).map((m) => <span key={m} title={m} className="bg-grad grid h-8 w-8 place-items-center rounded-full border-2 border-white text-xs font-bold text-white dark:border-slate-900">{m[0]}</span>)}{members.length > 5 && <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-200 text-xs dark:border-slate-900 dark:bg-slate-700">+{members.length - 5}</span>}</div>;
}

function AddExpenseModal({ open, onClose, groups, defaultGroup, onSaved }: { open: boolean; onClose: () => void; groups: Group[]; defaultGroup?: number; onSaved: () => void }) {
  const toast = useToast();
  const [gid, setGid] = useState<number>(defaultGroup ?? groups[0]?.id ?? 0);
  const g = groups.find((x) => x.id === gid) ?? groups[0];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("You");
  const [split, setSplit] = useState<string[] | null>(null);
  const members = g?.members ?? [];
  const sel = split ?? members;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!g) return toast.error("Create a group first");
    if (!title.trim()) return toast.error("Give the expense a title");
    if (!(Number(amount) > 0)) return toast.error("Enter a valid amount");
    if (!sel.length) return toast.error("Select at least one person to split with");
    await api.post("/api/resources/shared-expenses", { groupId: g.id, title: title.trim(), amount: Number(amount), paidBy, splitWith: sel, date: toInputDate() });
    toast.success("Shared expense added");
    setTitle(""); setAmount(""); setSplit(null);
    onSaved();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add shared expense">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Group"><select className="input" value={g?.id ?? ""} onChange={(e) => { setGid(Number(e.target.value)); setSplit(null); setPaidBy("You"); }}>{groups.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}</select></Field>
        <Field label="What was it for?"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner, tickets, rent…" /></Field>
        <div className="grid grid-cols-2 gap-4"><Field label="Amount"><input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Paid by"><select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{members.map((m) => <option key={m}>{m}</option>)}</select></Field></div>
        <div><label className="label">Split equally between</label><div className="flex flex-wrap gap-2">{members.map((m) => { const on = sel.includes(m); return <button type="button" key={m} onClick={() => setSplit(on ? sel.filter((x) => x !== m) : [...sel, m])} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition", on ? "bg-grad border-transparent text-white" : "border-slate-200 dark:border-white/10")}>{m}</button>; })}</div>{Number(amount) > 0 && sel.length > 0 && <p className="mt-2 text-xs text-slate-500">{money(Number(amount) / sel.length)} each</p>}</div>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Add expense</button></div>
      </form>
    </Modal>
  );
}

export function SharedExpenses() {
  const s = useShared();
  const toast = useToast();
  const confirm = useConfirm();
  const [add, setAdd] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader title="Shared Expenses" subtitle="Split bills with friends, flatmates and teams" icon={Users} actions={<button className="btn btn-primary" onClick={() => setAdd(true)} disabled={!s.groups.data?.length}><Plus className="h-4 w-4" /> Add expense</button>} />
      <Async q={s.bundle} skeleton={<PageSkeleton cards={2} rows={4} />}>
        {({ g, e, s: st }) => {
          let owed = 0;
          let owe = 0;
          for (const grp of g) { const v = balances(grp, e, st)["You"] ?? 0; if (v > 0) owed += v; else owe += -v; }
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2"><Card><p className="text-sm text-slate-500">You are owed</p><p className="money mt-1 text-3xl font-bold text-emerald-600">{money(owed)}</p></Card><Card><p className="text-sm text-slate-500">You owe</p><p className="money mt-1 text-3xl font-bold text-rose-500">{money(owe)}</p></Card></div>
              {e.length === 0 ? <EmptyState icon={Receipt} title="No shared expenses" body="Add one to start splitting." /> : (
                <div className="space-y-3">{e.map((x) => { const grp = g.find((y) => y.id === x.groupId); return (
                  <Card key={x.id} className="flex flex-wrap items-center gap-4 !p-4">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xl dark:bg-white/10">{grp?.emoji ?? "👥"}</span>
                    <div className="min-w-0 flex-1"><p className="font-semibold">{x.title}</p><p className="text-xs text-slate-500">{grp?.name} · {fmtDate(x.date)} · paid by <b>{x.paidBy}</b> · split {x.splitWith.length} ways</p></div>
                    <div className="text-right"><p className="money font-bold">{money(x.amount)}</p><p className="text-xs text-slate-500">{money(x.amount / (x.splitWith.length || 1))} each</p></div>
                    <button className="btn btn-ghost btn-sm !text-rose-500" aria-label={`Delete ${x.title}`} onClick={async () => { if (await confirm({ title: "Delete shared expense?", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/shared-expenses/${x.id}`); toast.success("Deleted"); s.reload(); } }}><Trash2 className="h-4 w-4" /></button>
                  </Card>); })}</div>
              )}
            </>
          );
        }}
      </Async>
      {s.groups.data && <AddExpenseModal open={add} onClose={() => setAdd(false)} groups={s.groups.data} onSaved={s.reload} />}
    </div>
  );
}

export function Groups() {
  const s = useShared();
  const toast = useToast();
  const confirm = useConfirm();
  const [create, setCreate] = useState(false);
  const [addTo, setAddTo] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader title="Groups" subtitle="Trips, homes and teams" icon={Users} actions={<button className="btn btn-primary" onClick={() => setCreate(true)}><Plus className="h-4 w-4" /> New group</button>} />
      <Async q={s.bundle} skeleton={<PageSkeleton cards={3} rows={0} />}>
        {({ g, e, s: st }) => g.length === 0 ? <EmptyState icon={Users} title="No groups yet" body="Create a group to split expenses." action={<button className="btn btn-primary" onClick={() => setCreate(true)}>Create group</button>} /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{g.map((grp) => {
            const mine = balances(grp, e, st)["You"] ?? 0;
            const total = e.filter((x) => x.groupId === grp.id).reduce((a, b) => a + b.amount, 0);
            return (
              <Card key={grp.id} hover>
                <div className="flex items-start justify-between"><span className="text-3xl">{grp.emoji}</span><button className="btn btn-ghost btn-sm !text-rose-500" aria-label={`Delete ${grp.name}`} onClick={async () => { if (await confirm({ title: `Delete ${grp.name}?`, message: "All its shared expenses and settlements will be removed.", confirmText: "Delete group", danger: true })) { for (const x of e.filter((y) => y.groupId === grp.id)) await api.del(`/api/resources/shared-expenses/${x.id}`); for (const x of st.filter((y) => y.groupId === grp.id)) await api.del(`/api/resources/settlements/${x.id}`); await api.del(`/api/resources/groups/${grp.id}`); toast.success("Group deleted"); s.reload(); } }}><Trash2 className="h-4 w-4" /></button></div>
                <h3 className="mt-2 text-lg font-semibold">{grp.name}</h3>
                <div className="mt-2 flex items-center justify-between"><Avatars members={grp.members} /><span className="text-xs text-slate-500">{grp.members.length} members</span></div>
                <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4 dark:border-white/5"><div><p className="text-xs text-slate-500">Total spent</p><p className="money font-semibold">{money(total)}</p></div><div className="text-right"><p className="text-xs text-slate-500">{mine >= 0 ? "You're owed" : "You owe"}</p><p className={cn("money font-bold", mine >= 0 ? "text-emerald-600" : "text-rose-500")}>{money(Math.abs(mine))}</p></div></div>
                <button className="btn btn-secondary btn-sm mt-4 w-full" onClick={() => setAddTo(grp.id)}><Plus className="h-4 w-4" /> Add expense</button>
              </Card>
            );
          })}</div>
        )}
      </Async>
      <Modal open={create} onClose={() => setCreate(false)} title="New group" size="sm">
        <ResourceForm fields={[{ key: "name", label: "Group name", type: "text", required: true, span: 2 }, { key: "emoji", label: "Emoji", type: "select", options: ["👥", "🏖️", "🏠", "🍱", "🎉", "✈️", "💼"] }, { key: "members", label: "Other members (comma separated)", type: "textarea", required: true, placeholder: "Aarav, Meera, Rohan" }]} initial={{ emoji: "👥" }} submitLabel="Create group" onCancel={() => setCreate(false)} onSubmit={async (v) => {
          const others = String(v.members).split(",").map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== "you");
          if (!others.length) return toast.error("Add at least one other member");
          await api.post("/api/resources/groups", { name: v.name, emoji: v.emoji, members: ["You", ...Array.from(new Set(others))] });
          toast.success("Group created"); setCreate(false); s.reload();
        }} />
      </Modal>
      {s.groups.data && addTo !== null && <AddExpenseModal open onClose={() => setAddTo(null)} groups={s.groups.data} defaultGroup={addTo} onSaved={s.reload} />}
    </div>
  );
}

export function Settlements() {
  const s = useShared();
  const toast = useToast();
  const confirm = useConfirm();
  const plans = useMemo(() => (s.ready ? s.groups.data!.map((g) => ({ g, steps: simplify(balances(g, s.expenses.data!, s.settlements.data!)) })) : []), [s.ready, s.groups.data, s.expenses.data, s.settlements.data]);
  return (
    <div className="space-y-6">
      <PageHeader title="Settlements" subtitle="Who owes whom — simplified" icon={HandCoins} />
      <Async q={s.bundle} skeleton={<PageSkeleton cards={0} rows={4} />}>
        {({ g, s: st }) => (
          <>
            {plans.every((p) => p.steps.length === 0) ? <EmptyState icon={HandCoins} title="All settled up 🎉" body="Nobody owes anything right now." /> : plans.filter((p) => p.steps.length).map(({ g: grp, steps }) => (
              <Card key={grp.id}>
                <SectionTitle title={`${grp.emoji} ${grp.name}`} />
                <ul className="space-y-3">{steps.map((x, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <b>{x.from}</b><ArrowRight className="h-4 w-4 text-slate-400" /><b>{x.to}</b>
                    <span className="money ml-auto text-lg font-bold">{money(x.amount)}</span>
                    <button className="btn btn-primary btn-sm" onClick={async () => { if (await confirm({ title: "Record settlement?", message: `${x.from} paid ${x.to} ${money(x.amount)}.`, confirmText: "Settle up" })) { await api.post("/api/resources/settlements", { groupId: grp.id, fromUser: x.from, toUser: x.to, amount: x.amount, status: "completed", date: toInputDate() }); toast.success("Settlement recorded"); s.reload(); } }}>Settle up</button>
                  </li>))}</ul>
              </Card>
            ))}
            <div>
              <SectionTitle title="History" />
              {st.length === 0 ? <p className="text-sm text-slate-500">No settlements recorded yet.</p> : <div className="card divide-y divide-slate-100 !p-0 dark:divide-white/5">{st.map((x) => <div key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"><Badge tone="green">{x.status}</Badge><span><b>{x.fromUser}</b> paid <b>{x.toUser}</b></span><span className="text-xs text-slate-500">{g.find((y) => y.id === x.groupId)?.name} · {fmtDate(x.date)}</span><span className="money ml-auto font-semibold">{money(x.amount)}</span></div>)}</div>}
            </div>
          </>
        )}
      </Async>
    </div>
  );
}
