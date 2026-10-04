"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, FileText, History, Images, Loader2, ScanLine, Trash2, Zap } from "lucide-react";
import { Async, Badge, Card, EmptyState, ListSkeleton, PageHeader, PageSkeleton, ProgressBar, SectionTitle, Segmented, statusTone } from "@/components/ui";
import { AiBadge } from "@/components/cards";
import { CameraModal, Dropzone, EmptyPreview, FilePreview, ImageZoom, ProcessingSteps, SCAN_STEPS, validateFiles, useObjectUrl } from "@/components/scanner";
import { Field } from "@/components/forms";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, catMeta } from "@/lib/constants";
import { cn, fmtDate, money, timeAgo, toInputDate } from "@/lib/format";
import type { Scan, Txn } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function DemoNote() {
  return <p className="text-center text-xs text-slate-400">Demo extraction engine — results are generated deterministically per file. Plug a real OCR/vision provider into <code>/api/scan</code> for production.</p>;
}

export function ReceiptScanner() {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const recent = useApi<Scan[]>("/api/resources/scans");

  const pick = (files: File[]) => {
    const { ok, errors } = validateFiles(files);
    errors.forEach((e) => toast.error(e));
    if (ok[0]) setFile(ok[0]);
  };

  const scan = async () => {
    if (!file) return;
    setBusy(true);
    setDone(false);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 620);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const [res] = await Promise.all([api.post<{ scans: Scan[] }>("/api/scan", fd), sleep(2600)]);
      clearInterval(timer);
      setStep(SCAN_STEPS.length);
      setDone(true);
      await sleep(600);
      router.push(`/scanner/result/${res.scans[0].id}`);
    } catch (e) {
      clearInterval(timer);
      toast.error(e instanceof Error ? e.message : "Scan failed");
      setBusy(false);
      setStep(0);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="AI Receipt Scanner" subtitle="Snap or upload a receipt — AI extracts everything in seconds" icon={ScanLine} actions={<><Link href="/scanner/batch" className="btn btn-secondary"><Images className="h-4 w-4" /> Batch</Link><Link href="/scanner/history" className="btn btn-secondary"><History className="h-4 w-4" /> History</Link></>} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {file ? (
            <FilePreview file={file} onRemove={() => setFile(null)} status={busy ? "scanning" : undefined} />
          ) : (
            <Dropzone onFiles={pick} disabled={busy} />
          )}
          {file && <PreviewLarge file={file} />}
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn btn-primary min-w-44 !py-3" disabled={!file || busy} onClick={scan}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} {busy ? "Scanning…" : "Scan Receipt"}
            </button>
            <button className="btn btn-secondary !py-3" onClick={() => setCamera(true)} disabled={busy}><Camera className="h-4 w-4" /> Use Camera</button>
            {file && !busy && <button className="btn btn-ghost !py-3" onClick={() => setFile(null)}>Choose another</button>}
          </div>
        </div>
        <Card className="lg:col-span-2">
          <SectionTitle title="AI Processing" action={<AiBadge />} />
          <ProcessingSteps active={busy ? step : -1} done={done} />
          <p className="mt-5 rounded-xl bg-slate-100 p-3 text-xs text-slate-500 dark:bg-white/5">Tip: flat, well-lit photos give the highest confidence. Totals, GST and category are all editable before saving.</p>
        </Card>
      </div>
      <DemoNote />
      <div>
        <SectionTitle title="Recent scans" action={<Link href="/scanner/history" className="text-xs font-medium text-indigo-500">View all →</Link>} />
        <Async q={recent} skeleton={<ListSkeleton rows={3} h="h-16" />}>
          {(scans) => scans.length === 0 ? <EmptyState icon={ScanLine} title="No scans yet" body="Your scanned receipts will appear here." /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {scans.slice(0, 4).map((s) => <ScanRow key={s.id} s={s} />)}
            </div>
          )}
        </Async>
      </div>
      <CameraModal open={camera} onClose={() => setCamera(false)} onCapture={(f) => setFile(f)} />
    </div>
  );
}

function PreviewLarge({ file }: { file: File }) {
  const url = useObjectUrl(file);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Receipt preview" className="mx-auto max-h-80 rounded-2xl border border-slate-200 object-contain dark:border-white/10" />
  );
}

function ScanRow({ s }: { s: Scan }) {
  return (
    <Link href={`/scanner/result/${s.id}`} className="card card-hover flex items-center gap-3 !p-3.5">
      <span className="text-2xl">{catMeta(s.category).emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.merchant}</p>
        <p className="truncate text-xs text-slate-500">{s.fileName} · {timeAgo(s.createdAt)}</p>
      </div>
      <div className="text-right"><p className="money font-semibold">{money(s.total)}</p><Badge tone={statusTone(s.status)}>{s.status}</Badge></div>
    </Link>
  );
}

export function ScanResult({ id }: { id: string }) {
  const q = useApi<Scan>(`/api/resources/scans/${id}`);
  return <Async q={q} skeleton={<PageSkeleton cards={2} rows={2} />}>{(scan) => <ScanEditor scan={scan} onChange={q.setData} />}</Async>;
}

function ScanEditor({ scan, onChange }: { scan: Scan; onChange: (s: Scan) => void }) {
  const router = useRouter();
  const toast = useToast();
  const isInvoice = scan.kind === "invoice";
  const [f, setF] = useState({ merchant: scan.merchant, date: toInputDate(scan.date), total: String(scan.total), tax: String(scan.tax), category: scan.category, paymentMethod: scan.paymentMethod });
  const [busy, setBusy] = useState(false);
  const saved = scan.status === "saved";
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const conf = scan.confidence;

  const save = async () => {
    if (!f.merchant.trim() || !(Number(f.total) > 0)) return toast.error("Merchant and a positive total are required");
    setBusy(true);
    try {
      const res = await api.post<{ transaction: Txn; scan: Scan }>(`/api/scan/${scan.id}/save`, { ...f, total: Number(f.total), tax: Number(f.tax) || 0 });
      onChange({ ...scan, ...res.scan });
      toast.success("Expense saved");
      router.push(`/expenses/${res.transaction.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Scan Result" subtitle={scan.fileName} icon={ScanLine} actions={<Link href="/scanner" className="btn btn-secondary">Scan another</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Receipt Preview" sub="Click to zoom" />
          {scan.previewUrl ? <ImageZoom src={scan.previewUrl} alt={`Receipt from ${scan.merchant}`} /> : <EmptyPreview />}
        </Card>
        <Card>
          <SectionTitle title="AI Extracted Data" action={<AiBadge />} />
          <div className="mb-5 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">AI Confidence</span><span className={cn("font-bold", conf >= 95 ? "text-emerald-500" : conf >= 90 ? "text-indigo-500" : "text-amber-500")}>{conf}%</span></div>
            <ProgressBar value={conf} color={conf >= 95 ? "#10b981" : conf >= 90 ? "#6366f1" : "#f59e0b"} warn={false} />
            {conf < 92 && <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Please double-check the highlighted fields.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Merchant" className="sm:col-span-2"><input className="input" value={f.merchant} onChange={(e) => set("merchant", e.target.value)} disabled={saved} /></Field>
            <Field label="Date"><input type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} disabled={saved} /></Field>
            <Field label="Total"><input type="number" className="input" value={f.total} onChange={(e) => set("total", e.target.value)} disabled={saved} /></Field>
            <Field label="Tax (GST)"><input type="number" className="input" value={f.tax} onChange={(e) => set("tax", e.target.value)} disabled={saved} /></Field>
            <Field label="Category"><select className="input" value={f.category} onChange={(e) => set("category", e.target.value)} disabled={saved}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Payment" className="sm:col-span-2"><select className="input" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} disabled={saved}>{PAYMENT_METHODS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          </div>
          {scan.items.length > 0 && (
            <div className="mt-5">
              <p className="label">Extracted items</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-white/5 dark:border-white/10">
                {scan.items.map((it, i) => <li key={i} className="flex justify-between px-3.5 py-2.5"><span>{it.name}{it.qty > 1 && <span className="text-slate-400"> × {it.qty}</span>}</span><span className="money font-medium">{money(it.price)}</span></li>)}
              </ul>
            </div>
          )}
          <div className="mt-6">
            {saved ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Already saved as an expense. <Link href="/expenses" className="font-semibold underline">View expenses</Link></p>
            ) : (
              <button className="btn btn-primary w-full !py-3" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Expense</button>
            )}
            {isInvoice && <Link href="/invoices/scanner" className="mt-2 block text-center text-xs text-indigo-500">This is an invoice — use the Invoice Scanner →</Link>}
          </div>
        </Card>
      </div>
    </div>
  );
}

type Status = "pending" | "scanning" | "done" | "error";

export function BatchScanner() {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Scan[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const add = (incoming: File[]) => {
    const { ok, errors } = validateFiles(incoming);
    errors.forEach((e) => toast.error(e));
    setFiles((p) => [...p, ...ok].slice(0, 20));
    setStatus((p) => [...p, ...ok.map(() => "pending" as Status)].slice(0, 20));
  };
  const run = async () => {
    setBusy(true);
    setStatus(files.map(() => "scanning"));
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const [res] = await Promise.all([api.post<{ scans: Scan[] }>("/api/scan", fd), sleep(1500)]);
      for (let i = 0; i < files.length; i++) {
        await sleep(180);
        setStatus((p) => p.map((s, j) => (j === i ? "done" : s)));
      }
      setResults(res.scans);
      toast.success(`${res.scans.length} receipts scanned`);
    } catch (e) {
      setStatus(files.map(() => "error"));
      toast.error(e instanceof Error ? e.message : "Batch scan failed");
    }
    setBusy(false);
  };
  const saveOne = async (s: Scan) => {
    try {
      await api.post(`/api/scan/${s.id}/save`, {});
      setSavedIds((p) => [...p, s.id]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };
  const saveAll = async () => {
    for (const s of results.filter((r) => !savedIds.includes(r.id))) await saveOne(s);
    toast.success("All expenses saved");
  };
  const reset = () => { setFiles([]); setStatus([]); setResults([]); setSavedIds([]); };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Batch Scanner" subtitle="Upload up to 20 receipts at once" icon={Images} actions={<Link href="/scanner" className="btn btn-secondary">Single scan</Link>} />
      {results.length === 0 && (
        <>
          <Dropzone multiple onFiles={add} disabled={busy} />
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => <FilePreview key={f.name + i} file={f} status={status[i]} onRemove={() => { setFiles((p) => p.filter((_, j) => j !== i)); setStatus((p) => p.filter((_, j) => j !== i)); }} />)}
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn btn-secondary" onClick={reset} disabled={busy}>Clear</button>
                <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Scan {files.length} receipt{files.length > 1 ? "s" : ""}</button>
              </div>
            </div>
          )}
        </>
      )}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{results.length} receipts extracted · total {money(results.reduce((a, b) => a + b.total, 0))}</p>
            <div className="flex gap-2"><button className="btn btn-secondary" onClick={reset}>Scan more</button><button className="btn btn-primary" onClick={saveAll} disabled={savedIds.length === results.length}><CheckCircle2 className="h-4 w-4" /> Save all</button></div>
          </div>
          {results.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center gap-4 !p-4">
              <span className="text-2xl">{catMeta(s.category).emoji}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold">{s.merchant}</p><p className="truncate text-xs text-slate-500">{s.fileName} · {s.category} · {fmtDate(s.date)}</p></div>
              <Badge tone={s.confidence >= 93 ? "green" : "amber"}>{s.confidence}%</Badge>
              <p className="money w-24 text-right font-bold">{money(s.total)}</p>
              <div className="flex gap-2">
                <Link href={`/scanner/result/${s.id}`} className="btn btn-secondary btn-sm">Review</Link>
                {savedIds.includes(s.id) ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Saved</Badge> : <button className="btn btn-primary btn-sm" onClick={() => saveOne(s)}>Save</button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <DemoNote />
    </div>
  );
}

export function OCRHistory() {
  const q = useApi<Scan[]>("/api/resources/scans");
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Scan[] | null>(null);
  useEffect(() => setRows(q.data), [q.data]);

  const del = async (s: Scan) => {
    if (!(await confirm({ title: "Delete scan?", message: `${s.fileName} will be removed from history. Saved expenses are not affected.`, confirmText: "Delete", danger: true }))) return;
    try {
      await api.del(`/api/resources/scans/${s.id}`);
      setRows((p) => p?.filter((x) => x.id !== s.id) ?? null);
      toast.success("Scan deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };
  const list = (rows ?? []).filter((s) => (filter === "all" || s.status === filter || s.kind === filter) && (!search || `${s.merchant} ${s.fileName}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="space-y-6">
      <PageHeader title="OCR History" subtitle="Every receipt and invoice you've scanned" icon={History} actions={<Link href="/scanner" className="btn btn-primary"><ScanLine className="h-4 w-4" /> New scan</Link>} />
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search scans…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search scans" />
        <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "processed", label: "To review" }, { value: "saved", label: "Saved" }, { value: "invoice", label: "Invoices" }]} />
      </div>
      <Async q={{ ...q, data: rows }} skeleton={<ListSkeleton rows={5} />}>
        {() => list.length === 0 ? <EmptyState icon={FileText} title="No scans match" body="Scan a receipt to see it here." action={<Link href="/scanner" className="btn btn-primary">Scan receipt</Link>} /> : (
          <div className="card divide-y divide-slate-100 overflow-hidden !p-0 dark:divide-white/5">
            {list.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xl dark:bg-white/10">{catMeta(s.category).emoji}</span>
                <Link href={`/scanner/result/${s.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate font-medium">{s.merchant} <span className="text-xs font-normal text-slate-400">· {s.kind}</span></p>
                  <p className="truncate text-xs text-slate-500">{s.fileName} · {(s.fileSize / 1024).toFixed(0)} KB · {timeAgo(s.createdAt)}</p>
                </Link>
                <Badge tone={s.confidence >= 93 ? "green" : "amber"}>{s.confidence}%</Badge>
                <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                <p className="money w-24 text-right font-semibold">{money(s.total)}</p>
                <button className="btn btn-ghost btn-sm !text-rose-500" onClick={() => del(s)} aria-label={`Delete ${s.fileName}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}
