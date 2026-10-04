"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Edit3, Landmark, Plus, Smartphone, Trash2, Wallet } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageHeader, PageSkeleton, ProgressBar, SectionTitle } from "@/components/ui";
import { ResourceForm, type FieldDef } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { TransactionExplorer } from "@/components/tables/TransactionExplorer";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { cn, money } from "@/lib/format";
import type { Account } from "@/lib/types";

const FIELDS: FieldDef[] = [
  { key: "name", label: "Account name", type: "text", required: true, placeholder: "HDFC Savings", span: 2 },
  { key: "type", label: "Type", type: "select", options: [{ value: "bank", label: "Bank account" }, { value: "card", label: "Credit card" }, { value: "wallet", label: "Wallet" }] },
  { key: "institution", label: "Institution", type: "text", placeholder: "HDFC Bank" },
  { key: "last4", label: "Last 4 digits", type: "text", placeholder: "4821" },
  { key: "balance", label: "Balance (negative for card dues)", type: "number", required: true },
  { key: "creditLimit", label: "Credit limit (cards)", type: "number", min: 0 },
  { key: "color", label: "Colour", type: "select", options: [{ value: "#6366f1", label: "Indigo" }, { value: "#1d4ed8", label: "Blue" }, { value: "#7c3aed", label: "Violet" }, { value: "#10b981", label: "Emerald" }, { value: "#f97316", label: "Orange" }, { value: "#0f172a", label: "Midnight" }] },
];

export function CardVisual({ a }: { a: Account }) {
  const util = a.creditLimit > 0 ? (Math.abs(Math.min(0, a.balance)) / a.creditLimit) * 100 : 0;
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${a.color}, #0f172a 130%)` }}>
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="flex items-start justify-between"><p className="text-sm font-medium opacity-90">{a.institution || a.name}</p><CreditCard className="h-6 w-6 opacity-80" /></div>
      <p className="mt-8 font-mono text-lg tracking-widest">•••• •••• •••• {a.last4 || "0000"}</p>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-xs opacity-70">{a.name}</p><p className="money text-xl font-bold">{a.type === "card" ? `${money(Math.abs(a.balance))} due` : money(a.balance)}</p></div>{a.creditLimit > 0 && <div className="w-24 text-right"><p className="text-[11px] opacity-70">{util.toFixed(0)}% used</p><div className="mt-1 h-1.5 rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, util)}%` }} /></div></div>}</div>
    </div>
  );
}

function useAddAccount(reload: () => void, defaults: Record<string, unknown> = {}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const modal = (
    <Modal open={open} onClose={() => setOpen(false)} title="Add account">
      <ResourceForm fields={FIELDS} initial={{ type: "bank", color: "#6366f1", balance: 0, creditLimit: 0, ...defaults }} submitLabel="Add account" onCancel={() => setOpen(false)} onSubmit={async (v) => { await api.post("/api/resources/accounts", v); toast.success("Account added"); setOpen(false); reload(); }} />
    </Modal>
  );
  return { setOpen, modal };
}

function Row({ a }: { a: Account }) {
  const Icon = a.type === "card" ? CreditCard : a.type === "wallet" ? Smartphone : Landmark;
  return (
    <Link href={`/accounts/${a.id}`} className="card card-hover flex items-center gap-4 !p-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: a.color }}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="font-semibold">{a.name}</p><p className="text-xs text-slate-500">{a.institution}{a.last4 && ` ••${a.last4}`}</p></div>
      <p className={cn("money text-lg font-bold", a.balance < 0 && "text-rose-500")}>{money(a.balance)}</p>
    </Link>
  );
}

export function Accounts() {
  const q = useApi<Account[]>("/api/resources/accounts");
  const { setOpen, modal } = useAddAccount(q.reload);
  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" subtitle="Banks, cards and wallets in one place" icon={Landmark} actions={<><Link href="/accounts/cards" className="btn btn-secondary"><CreditCard className="h-4 w-4" /> Cards</Link><Link href="/accounts/wallets" className="btn btn-secondary"><Wallet className="h-4 w-4" /> Wallets</Link><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add</button></>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={4} />}>
        {(list) => {
          const assets = list.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
          const debt = list.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);
          if (!list.length) return <EmptyState icon={Landmark} title="No accounts yet" body="Add an account so balances update with every transaction." action={<button className="btn btn-primary" onClick={() => setOpen(true)}>Add account</button>} />;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-grad !border-0 text-white"><p className="text-sm opacity-80">Net worth</p><p className="money mt-1 text-3xl font-bold">{money(assets + debt)}</p></Card>
                <Card><p className="text-sm text-slate-500">Assets</p><p className="money mt-1 text-2xl font-bold text-emerald-600">{money(assets)}</p></Card>
                <Card><p className="text-sm text-slate-500">Liabilities</p><p className="money mt-1 text-2xl font-bold text-rose-500">{money(debt)}</p></Card>
              </div>
              {(["bank", "card", "wallet"] as const).map((t) => {
                const g = list.filter((a) => a.type === t);
                return g.length ? <div key={t}><SectionTitle title={t === "bank" ? "Bank accounts" : t === "card" ? "Credit cards" : "Wallets"} /><div className="grid gap-3 md:grid-cols-2">{g.map((a) => <Row key={a.id} a={a} />)}</div></div> : null;
              })}
            </>
          );
        }}
      </Async>
      {modal}
    </div>
  );
}

export function AccountDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Account>(`/api/resources/accounts/${id}`);
  const [edit, setEdit] = useState(false);
  return (
    <div className="space-y-6">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={3} />}>
        {(a) => (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1"><CardVisual a={a} /></div>
              <Card className="lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{a.name}</h1><Badge tone="slate">{a.type}</Badge></div><p className={cn("money text-3xl font-bold", a.balance < 0 && "text-rose-500")}>{money(a.balance)}</p></div>
                {a.creditLimit > 0 && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Credit used</span><span>{money(Math.abs(Math.min(0, a.balance)))} of {money(a.creditLimit)}</span></div><ProgressBar value={Math.abs(Math.min(0, a.balance))} max={a.creditLimit} /></div>}
                <div className="mt-6 flex gap-2"><button className="btn btn-secondary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</button><button className="btn btn-danger ml-auto" onClick={async () => { if (await confirm({ title: `Delete ${a.name}?`, message: "Linked transactions are kept but will no longer be tied to this account.", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/accounts/${id}`); toast.success("Account deleted"); router.push("/accounts"); } }}><Trash2 className="h-4 w-4" /> Delete</button></div>
              </Card>
            </div>
            <div><SectionTitle title="Transactions" /><TransactionExplorer type="all" extra={{ accountId: id }} hideAdd pageSize={10} /></div>
            <Modal open={edit} onClose={() => setEdit(false)} title="Edit account"><ResourceForm fields={FIELDS} initial={a} onCancel={() => setEdit(false)} onSubmit={async (v) => { q.setData(await api.patch<Account>(`/api/resources/accounts/${id}`, v)); setEdit(false); toast.success("Saved"); }} /></Modal>
          </>
        )}
      </Async>
    </div>
  );
}

export function Cards() {
  const q = useApi<Account[]>("/api/resources/accounts");
  const { setOpen, modal } = useAddAccount(q.reload, { type: "card", balance: 0, creditLimit: 100000, color: "#7c3aed" });
  return (
    <div className="space-y-6">
      <PageHeader title="Cards" subtitle="Credit utilisation and dues" icon={CreditCard} actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add card</button>} />
      <Async q={q} skeleton={<PageSkeleton cards={2} rows={0} />}>
        {(list) => {
          const cards = list.filter((a) => a.type === "card");
          const due = cards.reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0);
          const limit = cards.reduce((s, a) => s + a.creditLimit, 0);
          if (!cards.length) return <EmptyState icon={CreditCard} title="No cards" body="Add a credit card to track dues and utilisation." />;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3"><Card><p className="text-sm text-slate-500">Total due</p><p className="money mt-1 text-2xl font-bold text-rose-500">{money(due)}</p></Card><Card><p className="text-sm text-slate-500">Total limit</p><p className="money mt-1 text-2xl font-bold">{money(limit)}</p></Card><Card><p className="text-sm text-slate-500">Utilisation</p><p className="mt-1 text-2xl font-bold">{limit ? ((due / limit) * 100).toFixed(1) : 0}%</p><p className="text-xs text-slate-500">Keep below 30% for a healthy credit score</p></Card></div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cards.map((a) => <Link key={a.id} href={`/accounts/${a.id}`} className="transition hover:-translate-y-1"><CardVisual a={a} /></Link>)}</div>
            </>
          );
        }}
      </Async>
      {modal}
    </div>
  );
}

export function Wallets() {
  const toast = useToast();
  const q = useApi<Account[]>("/api/resources/accounts");
  const { setOpen, modal } = useAddAccount(q.reload, { type: "wallet", balance: 0, color: "#0284c7" });
  const [adj, setAdj] = useState<{ a: Account; dir: 1 | -1 } | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader title="Wallets" subtitle="UPI wallets and prepaid balances" icon={Smartphone} actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add wallet</button>} />
      <Async q={q} skeleton={<PageSkeleton cards={2} rows={0} />}>
        {(list) => {
          const w = list.filter((a) => a.type === "wallet");
          if (!w.length) return <EmptyState icon={Smartphone} title="No wallets" body="Add a wallet like Paytm or Amazon Pay." />;
          return (
            <div className="grid gap-4 md:grid-cols-2">{w.map((a) => (
              <Card key={a.id} hover>
                <div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: a.color }}><Smartphone className="h-6 w-6" /></span><div className="flex-1"><p className="font-semibold">{a.name}</p><p className="text-xs text-slate-500">{a.institution}</p></div><p className="money text-2xl font-bold">{money(a.balance)}</p></div>
                <div className="mt-4 flex gap-2"><button className="btn btn-secondary btn-sm flex-1" onClick={() => setAdj({ a, dir: 1 })}><ArrowDownCircle className="h-4 w-4 text-emerald-500" /> Add money</button><button className="btn btn-secondary btn-sm flex-1" onClick={() => setAdj({ a, dir: -1 })}><ArrowUpCircle className="h-4 w-4 text-rose-500" /> Withdraw</button></div>
              </Card>
            ))}</div>
          );
        }}
      </Async>
      <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `${adj.dir > 0 ? "Add money to" : "Withdraw from"} ${adj.a.name}` : ""} size="sm">
        {adj && <ResourceForm fields={[{ key: "amount", label: "Amount", type: "number", required: true, min: 1, span: 2 }]} onCancel={() => setAdj(null)} submitLabel={adj.dir > 0 ? "Add" : "Withdraw"} onSubmit={async (v) => { const amt = Number(v.amount); if (adj.dir < 0 && amt > adj.a.balance) return toast.error("Insufficient wallet balance"); await api.patch(`/api/resources/accounts/${adj.a.id}`, { balance: adj.a.balance + adj.dir * amt }); toast.success("Balance updated"); setAdj(null); q.reload(); }} />}
      </Modal>
      {modal}
    </div>
  );
}
