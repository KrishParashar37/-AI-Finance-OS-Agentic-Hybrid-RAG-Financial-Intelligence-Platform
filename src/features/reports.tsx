"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileBarChart, FileSpreadsheet, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Async, Badge, Card, EmptyState, ListSkeleton, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { DateRangePicker } from "@/components/forms";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { cn, fmtDate, timeAgo, toInputDate } from "@/lib/format";
import type { Report } from "@/lib/types";

export const REPORT_TYPES = [
  { value: "monthly", label: "Monthly", desc: "Day-by-day income & spend" },
  { value: "annual", label: "Annual", desc: "Month-by-month summary" },
  { value: "tax", label: "Tax", desc: "GST paid & taxable income" },
  { value: "expenses", label: "Expenses", desc: "Every expense line" },
  { value: "income", label: "Income", desc: "Every income line" },
  { value: "budget", label: "Budget", desc: "Budget vs actual" },
  { value: "ai", label: "AI Financial Report", desc: "Insights & advice" },
];
const label = (t: string) => REPORT_TYPES.find((x) => x.value === t)?.label ?? t;
const FORMATS = [{ value: "pdf", label: "PDF", icon: FileText }, { value: "excel", label: "Excel", icon: FileSpreadsheet }, { value: "csv", label: "CSV", icon: FileText }];
const fmtLabel = (f: string) => (f === "xlsx" || f === "excel" ? "Excel" : f.toUpperCase());
const dl = (id: number, fmt: string) => `/api/reports/${id}/download?format=${fmt === "xlsx" ? "excel" : fmt}`;

export function Reports() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Report[]>("/api/resources/reports");
  const [busy, setBusy] = useState("");
  const quick = async (key: string, type: string, from: Date, to: Date, format: string) => {
    setBusy(key);
    try {
      const r = await api.post<Report>("/api/reports/generate", { type, format, from: toInputDate(from), to: toInputDate(to) });
      toast.success("Report generated");
      router.push(`/reports/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setBusy("");
    }
  };
  const n = new Date();
  const templates = [
    { key: "t1", title: "This month", sub: "Monthly · PDF", run: () => quick("t1", "monthly", new Date(n.getFullYear(), n.getMonth(), 1), n, "pdf") },
    { key: "t2", title: "Last month", sub: "Expenses · Excel", run: () => quick("t2", "expenses", new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0), "excel") },
    { key: "t3", title: "Year to date", sub: "Tax · Excel", run: () => quick("t3", "tax", new Date(n.getFullYear(), 0, 1), n, "excel") },
    { key: "t4", title: "AI summary", sub: "AI report · PDF", run: () => quick("t4", "ai", new Date(n.getFullYear(), n.getMonth() - 2, 1), n, "pdf") },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Export your finances as PDF, Excel or CSV" icon={FileBarChart} actions={<Link href="/reports/generate" className="btn btn-primary"><Plus className="h-4 w-4" /> Generate report</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{templates.map((t) => <button key={t.key} onClick={t.run} disabled={!!busy} className="card card-hover flex cursor-pointer items-center gap-3 text-left disabled:opacity-60"><span className="bg-grad grid h-11 w-11 place-items-center rounded-xl text-white">{busy === t.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}</span><span><span className="block font-semibold">{t.title}</span><span className="text-xs text-slate-500">{t.sub}</span></span></button>)}</div>
      <div>
        <SectionTitle title="Report history" />
        <Async q={q} skeleton={<ListSkeleton rows={4} />}>
          {(list) => list.length === 0 ? <EmptyState icon={FileBarChart} title="No reports yet" body="Generate your first report." action={<Link href="/reports/generate" className="btn btn-primary">Generate</Link>} /> : (
            <div className="space-y-3">{list.map((r) => (
              <Card key={r.id} hover className="flex flex-wrap items-center gap-4 !p-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><FileText className="h-5 w-5" /></span>
                <Link href={`/reports/${r.id}`} className="min-w-0 flex-1"><p className="font-semibold">{label(r.type)} report</p><p className="text-xs text-slate-500">{fmtDate(r.rangeStart)} → {fmtDate(r.rangeEnd)} · {r.rowCount} rows · {timeAgo(r.createdAt)}</p></Link>
                <Badge tone="violet">{fmtLabel(r.format)}</Badge>
                <a href={dl(r.id, r.format)} className="btn btn-secondary btn-sm"><Download className="h-4 w-4" /> Download</a>
                <button className="btn btn-ghost btn-sm !text-rose-500" aria-label="Delete report" onClick={async () => { if (await confirm({ title: "Delete report?", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/reports/${r.id}`); toast.success("Deleted"); q.reload(); } }}><Trash2 className="h-4 w-4" /></button>
              </Card>))}</div>
          )}
        </Async>
      </div>
    </div>
  );
}

export function GenerateReport() {
  const toast = useToast();
  const n = new Date();
  const [type, setType] = useState("monthly");
  const [from, setFrom] = useState(toInputDate(new Date(n.getFullYear(), n.getMonth(), 1)));
  const [to, setTo] = useState(toInputDate(n));
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Report | null>(null);
  const go = async () => {
    if (!from || !to) return toast.error("Pick a date range");
    if (from > to) return toast.error("Start date must be before end date");
    setBusy(true);
    try {
      setDone(await api.post<Report>("/api/reports/generate", { type, format, from, to }));
      toast.success("Report generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    }
    setBusy(false);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Generate Report" subtitle="Choose a type, range and format" icon={FileBarChart} />
      <Card className="space-y-6 !p-6">
        <div>
          <p className="label">Report type</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">{REPORT_TYPES.map((t) => (
            <button key={t.value} role="radio" aria-checked={type === t.value} onClick={() => setType(t.value)} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition", type === t.value ? "border-[color:var(--ac1)] bg-indigo-500/5 ring-2 ring-[color:var(--ac1)]/20" : "border-slate-200 hover:border-slate-300 dark:border-white/10")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full border-2", type === t.value ? "border-[color:var(--ac1)]" : "border-slate-300")}>{type === t.value && <span className="bg-grad h-2.5 w-2.5 rounded-full" />}</span>
              <span><span className="block text-sm font-semibold">{t.label}</span><span className="text-xs text-slate-500">{t.desc}</span></span>
            </button>))}</div>
        </div>
        <div><p className="label">Date range</p><DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} /></div>
        <div><p className="label">Format</p><div className="flex gap-2">{FORMATS.map((f) => <button key={f.value} onClick={() => setFormat(f.value)} className={cn("btn flex-1 border", format === f.value ? "bg-grad border-transparent text-white" : "btn-secondary")}><f.icon className="h-4 w-4" /> {f.label}</button>)}</div></div>
        <button className="btn btn-primary w-full !py-3" onClick={go} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />} Generate Report</button>
      </Card>
      {done && (
        <Card className="!border-emerald-300/60 !bg-emerald-50/60 dark:!border-emerald-500/30 dark:!bg-emerald-500/10">
          <div className="flex flex-wrap items-center gap-4"><CheckCircle2 className="h-8 w-8 text-emerald-500" /><div className="flex-1"><p className="font-semibold">{label(done.type)} report is ready</p><p className="text-sm text-slate-600 dark:text-slate-300">{done.rowCount} rows · {fmtLabel(done.format)}</p></div><a className="btn btn-primary" href={dl(done.id, done.format)}><Download className="h-4 w-4" /> Download</a><Link href={`/reports/${done.id}`} className="btn btn-secondary">Preview</Link></div>
        </Card>
      )}
    </div>
  );
}

type Detail = { report: Report; preview: { title: string; headers: string[]; summary: string[]; rows: string[][]; totalRows: number } };

export function ReportDetails({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Detail>(`/api/reports/${id}`);
  return (
    <div className="space-y-6">
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={4} />}>
        {({ report: r, preview: p }) => (
          <>
            <PageHeader title={p.title} subtitle={`${fmtDate(r.rangeStart)} → ${fmtDate(r.rangeEnd)} · generated ${timeAgo(r.createdAt)}`} icon={FileBarChart} actions={<>{["pdf", "excel", "csv"].map((f) => <a key={f} href={dl(r.id, f)} className={cn("btn", f === (r.format === "xlsx" ? "excel" : r.format) ? "btn-primary" : "btn-secondary")}><Download className="h-4 w-4" /> {fmtLabel(f)}</a>)}<button className="btn btn-danger" aria-label="Delete report" onClick={async () => { if (await confirm({ title: "Delete report?", confirmText: "Delete", danger: true })) { await api.del(`/api/resources/reports/${id}`); toast.success("Deleted"); router.push("/reports"); } }}><Trash2 className="h-4 w-4" /></button></>} />
            <Card><SectionTitle title="Summary" /><ul className="space-y-1.5 text-sm">{p.summary.map((s, i) => <li key={i} className={s ? "" : "h-2"}>{s}</li>)}</ul></Card>
            <Card className="overflow-x-auto !p-0">
              <div className="p-5 pb-3"><SectionTitle title="Data preview" sub={`Showing ${p.rows.length} of ${p.totalRows} rows`} /></div>
              {p.rows.length === 0 ? <div className="p-5 pt-0"><EmptyState title="No data in this range" /></div> : (
                <table className="w-full min-w-[560px]"><thead className="border-y border-slate-100 dark:border-white/10"><tr>{p.headers.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">{p.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="td">{c}</td>)}</tr>)}</tbody></table>
              )}
            </Card>
          </>
        )}
      </Async>
    </div>
  );
}
