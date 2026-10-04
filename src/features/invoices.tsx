"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit3, FileText, Loader2, Plus, Printer, ScanLine, Trash2, Zap } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageHeader, PageSkeleton, Segmented, statusTone } from "@/components/ui";
import { AiBadge } from "@/components/cards";
import { ResourceForm, type FieldDef } from "@/components/forms/ResourceForm";
import { Modal } from "@/components/modals/Modal";
import { Dropzone, FilePreview, ProcessingSteps, SCAN_STEPS, validateFiles } from "@/components/scanner";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { daysUntil, fmtDate, money, toInputDate } from "@/lib/format";
import type { Invoice, Scan } from "@/lib/types";

const FIELDS: FieldDef[] = [
  { key: "number", label: "Invoice number", type: "text", required: true, placeholder: "INV-2026-0001" },
  { key: "party", label: "Vendor / client", type: "text", required: true },
  { key: "kind", label: "Type", type: "select", options: [{ value: "payable", label: "Payable (I owe)" }, { value: "receivable", label: "Receivable (owed to me)" }] },
  { key: "status", label: "Status", type: "select", options: ["pending", "paid", "overdue"] },
  { key: "amount", label: "Total amount", type: "number", required: true, min: 1 },
  { key: "tax", label: "Tax included", type: "number", min: 0 },
  { key: "issueDate", label: "Issue date", type: "date", required: true },
  { key: "dueDate", label: "Due date", type: "date", required: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

const eff = (i: Invoice) => (i.status === "pending" && daysUntil(i.dueDate) < 0 ? "overdue" : i.status);
const blank = () => ({ number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`, kind: "payable", status: "pending", tax: 0, issueDate: toInputDate(), dueDate: toInputDate(new Date(Date.now() + 14 * 86400000)) });

export function Invoices() {
  const toast = useToast();
  const q = useApi<Invoice[]>("/api/resources/invoices");
  const [kind, setKind] = useState("all");
  const [add, setAdd] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle="Payables and receivables" icon={FileText} actions={<><Link href="/invoices/scanner" className="btn btn-secondary"><ScanLine className="h-4 w-4" /> Scan invoice</Link><button className="btn btn-primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> New</button></>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={4} />}>
        {(list) => {
          const sum = (f: (i: Invoice) => boolean) => list.filter(f).reduce((a, b) => a + b.amount, 0);
          const shown = list.filter((i) => kind === "all" || i.kind === kind);
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card><p className="text-sm text-slate-500">To receive</p><p className="money mt-1 text-2xl font-bold text-emerald-600">{money(sum((i) => i.kind === "receivable" && i.status !== "paid"))}</p></Card>
                <Card><p className="text-sm text-slate-500">To pay</p><p className="money mt-1 text-2xl font-bold">{money(sum((i) => i.kind === "payable" && i.status !== "paid"))}</p></Card>
                <Card><p className="text-sm text-slate-500">Overdue</p><p className="money mt-1 text-2xl font-bold text-rose-500">{money(sum((i) => eff(i) === "overdue"))}</p></Card>
              </div>
              <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "payable", label: "Payable" }, { value: "receivable", label: "Receivable" }]} />
              {shown.length === 0 ? <EmptyState icon={FileText} title="No invoices" body="Create or scan an invoice." /> : (
                <div className="space-y-3">{shown.map((i) => (
                  <Card key={i.id} hover className="flex flex-wrap items-center gap-4 !p-4">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ${i.kind === "receivable" ? "bg-emerald-500/10 text-emerald-500" : "bg-violet-500/10 text-violet-500"}`}><FileText className="h-5 w-5" /></span>
                    <Link href={`/invoices/${i.id}`} className="min-w-0 flex-1"><p className="font-semibold">{i.party}</p><p className="text-xs text-slate-500">{i.number} · due {fmtDate(i.dueDate)}</p></Link>
                    <Badge tone={i.kind === "receivable" ? "green" : "violet"}>{i.kind}</Badge>
                    <Badge tone={statusTone(eff(i))}>{eff(i)}</Badge>
                    <p className="money w-24 text-right text-lg font-bold">{money(i.amount)}</p>
                    {i.status !== "paid" && <button className="btn btn-secondary btn-sm" onClick={async () => { await api.patch(`/api/resources/invoices/${i.id}`, { status: "paid" }); toast.success("Marked paid"); q.reload(); }}><CheckCircle2 className="h-4 w-4" /> Paid</button>}
                  </Card>
                ))}</div>
              )}
            </>
          );
        }}
      </Async>
      <Modal open={add} onClose={() => setAdd(false)} title="New invoice" size="lg"><ResourceForm fields={FIELDS} initial={blank()} submitLabel="Create invoice" onCancel={() => setAdd(false)} onSubmit={async (v) => { await api.post("/api/resources/invoices", v); toast.success("Invoice created"); setAdd(false); q.reload(); }} /></Modal>
    </div>
  );
}

export function InvoiceDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Invoice>(`/api/resources/invoices/${id}`);
  const [edit, setEdit] = useState(false);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={2} />}>
        {(i) => (
          <>
            <Card className="!p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
                <div><p className="text-xs tracking-widest text-slate-400 uppercase">Invoice</p><h1 className="text-2xl font-bold">{i.number}</h1><Badge tone={statusTone(eff(i))} className="mt-2">{eff(i)}</Badge></div>
                <div className="text-right"><p className="text-xs text-slate-500">{i.kind === "payable" ? "From" : "Billed to"}</p><p className="text-lg font-semibold">{i.party}</p></div>
              </div>
              <dl className="grid gap-5 py-6 sm:grid-cols-3">{[["Issued", fmtDate(i.issueDate)], ["Due", fmtDate(i.dueDate)], ["Type", i.kind]].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 font-medium capitalize">{v}</dd></div>)}</dl>
              <div className="space-y-2 rounded-2xl bg-slate-50 p-5 dark:bg-white/5"><div className="flex justify-between text-sm"><span>Subtotal</span><span className="money">{money(i.amount - i.tax)}</span></div><div className="flex justify-between text-sm"><span>Tax</span><span className="money">{money(i.tax)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold dark:border-white/10"><span>Total</span><span className="money">{money(i.amount)}</span></div></div>
              {i.notes && <p className="mt-4 text-sm text-slate-500">{i.notes}</p>}
            </Card>
            <div className="flex flex-wrap gap-2">
              {i.status !== "paid" && <button className="btn btn-primary" onClick={async () => { q.setData(await api.patch<Invoice>(`/api/resources/invoices/${id}`, { status: "paid" })); toast.success("Marked paid"); }}><CheckCircle2 className="h-4 w-4" /> Mark paid</button>}
              <button className="btn btn-secondary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</button>
              <button className="btn btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
              <button className="btn btn-danger ml-auto" onClick={async () => { if (await confirm({ title: "Delete invoice?", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/invoices/${id}`); toast.success("Deleted"); router.push("/invoices"); } }}><Trash2 className="h-4 w-4" /></button>
            </div>
            <Modal open={edit} onClose={() => setEdit(false)} title="Edit invoice" size="lg"><ResourceForm fields={FIELDS} initial={{ ...i, issueDate: toInputDate(i.issueDate), dueDate: toInputDate(i.dueDate) }} onCancel={() => setEdit(false)} onSubmit={async (v) => { q.setData(await api.patch<Invoice>(`/api/resources/invoices/${id}`, v)); setEdit(false); toast.success("Saved"); }} /></Modal>
          </>
        )}
      </Async>
    </div>
  );
}

export function InvoiceScanner() {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<(Scan & { invoiceNumber: string }) | null>(null);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 550);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("kind", "invoice");
      const [res] = await Promise.all([api.post<{ scans: (Scan & { invoiceNumber: string })[] }>("/api/scan", fd), new Promise((r) => setTimeout(r, 2200))]);
      setResult(res.scans[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    }
    clearInterval(t);
    setBusy(false);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Invoice Scanner" subtitle="Extract vendor, number, tax and due date from any invoice" icon={ScanLine} actions={<AiBadge />} />
      {!result ? (
        <>
          {file ? <FilePreview file={file} onRemove={() => setFile(null)} status={busy ? "scanning" : undefined} /> : <Dropzone onFiles={(f) => { const { ok, errors } = validateFiles(f); errors.forEach(toast.error); if (ok[0]) setFile(ok[0]); }} />}
          {busy && <Card><ProcessingSteps active={step} done={false} /></Card>}
          <div className="flex justify-center"><button className="btn btn-primary min-w-44 !py-3" disabled={!file || busy} onClick={run}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Scan invoice</button></div>
        </>
      ) : (
        <Card className="!p-6">
          <div className="mb-4 flex items-center justify-between"><p className="font-semibold">Review extracted invoice</p><Badge tone="green">{result.confidence}% confidence</Badge></div>
          <ResourceForm
            fields={FIELDS}
            initial={{ number: result.invoiceNumber, party: result.merchant, kind: "payable", status: "pending", amount: result.total, tax: result.tax, issueDate: toInputDate(result.date), dueDate: toInputDate(new Date(new Date(result.date).getTime() + 14 * 86400000)) }}
            submitLabel="Save invoice"
            onCancel={() => { setResult(null); setFile(null); }}
            onSubmit={async (v) => { const row = await api.post<Invoice>("/api/resources/invoices", v); toast.success("Invoice saved"); router.push(`/invoices/${row.id}`); }}
          />
        </Card>
      )}
    </div>
  );
}
