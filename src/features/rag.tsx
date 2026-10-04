"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Brain, ChevronRight, Database, FileText, Loader2,
  Search, Send, Sparkles, Trash2, Upload, Zap,
  CheckCircle2, AlertTriangle, BookOpen, BarChart3,
  RefreshCw, Download, Eye, EyeOff, Copy,
  Clock, Activity, Shield,
  MessageSquare,
  ThumbsUp, ThumbsDown, Bookmark,
} from "lucide-react";
import {
  Async, Badge, Card, EmptyState, PageHeader,
  PageSkeleton, SectionTitle, StatCard, ProgressBar,
} from "@/components/ui";
import { useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { cn, timeAgo } from "@/lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────
const num = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number) => `${n.toFixed(1)}%`;

// ── Types ─────────────────────────────────────────────────────────────────────
type RagStats = {
  documents: number; chunks: number; embeddings: number;
  queries: number; vector_db: string; indexed_pct: number;
  avg_latency_ms: number; cache_hit_rate: number;
  top_doc_types: { type: string; count: number }[];
  daily_queries: { date: string; count: number }[];
  recent_queries: { id: number; query: string; mode: string; latency_ms: number; chunks: number; createdAt: string; rating?: number }[];
};
type RagDoc = {
  id: string; filename: string; doc_type: string; char_count: number;
  chunk_count: number; status: string; createdAt: string; size_kb: number;
};
type Citation = {
  type: "document" | "sql"; title: string; doc_type?: string;
  score?: number; preview?: string; document_id?: string;
  count?: number; total?: number;
};
type RagAnswer = {
  query: string; answer: string; citations: Citation[];
  mode: string; steps: string[]; latency_ms: number; query_id: number;
};

// ── MODE badge ────────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = {
    sql: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    vector: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    hybrid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase", colors[mode] ?? colors.hybrid)}>
      {mode}
    </span>
  );
}

// ── Citation card ─────────────────────────────────────────────────────────────
function CitationCard({ c, i }: { c: Citation; i: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-indigo-500/15 text-xs font-bold text-indigo-600">
          {i}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{c.title}</p>
            {c.type === "document" && c.score !== undefined && (
              <span className="text-xs text-slate-400">score {c.score.toFixed(2)}</span>
            )}
          </div>
          {c.preview && (
            <p className={cn("mt-1 text-xs text-slate-500", !expanded && "line-clamp-2")}>{c.preview}</p>
          )}
          {c.preview && c.preview.length > 100 && (
            <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-indigo-500 hover:underline">
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          {c.type === "sql" && (
            <p className="mt-1 text-xs text-slate-500">
              {c.count} transactions · ₹{(c.total ?? 0).toLocaleString("en-IN")}
            </p>
          )}
        </div>
        {c.type === "document" ? (
          <FileText className="h-4 w-4 shrink-0 text-indigo-400" />
        ) : (
          <Database className="h-4 w-4 shrink-0 text-sky-400" />
        )}
      </div>
    </div>
  );
}

// ── Mini bar chart (for dashboard) ────────────────────────────────────────────
function MiniBarChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex items-end gap-1" style={{ height: 80 }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex flex-1 flex-col items-center">
            <div
              className="w-full rounded-t-md bg-indigo-500/80 transition-all group-hover:bg-indigo-600"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute -top-7 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {d.count}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

// ── Feature 1: Donut chart for doc types ──────────────────────────────────────
function DocTypeDonut({ data }: { data: { type: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
  // Precompute per-segment share + cumulative offset so nothing is reassigned during render.
  const pcts = data.map((d) => (d.count / total) * 100);
  const segments = data.map((d, i) => ({
    type: d.type,
    pct: pcts[i],
    offset: pcts.slice(0, i).reduce((s, p) => s + p, 0),
  }));
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 36 36" className="h-28 w-28 shrink-0">
        {segments.map((s, i) => (
          <circle key={s.type} cx="18" cy="18" r="15.9" fill="none" stroke={colors[i % colors.length]}
            strokeWidth="3.5" strokeDasharray={`${s.pct} ${100 - s.pct}`} strokeDashoffset={-s.offset}
            className="transition-all duration-500" />
        ))}
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={d.type} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="text-slate-600 dark:text-slate-300">{d.type.replace(/_/g, " ")}</span>
            <span className="font-semibold">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RAG DASHBOARD (Features 1-8)
// ══════════════════════════════════════════════════════════════════════════════
export function RAGDashboard() {
  const q = useApi<RagStats>("/api/rag/stats");
  const toast = useToast();
  const [reindexing, setReindexing] = useState(false);

  // Feature 2: Re-index all documents
  const reindex = async () => {
    setReindexing(true);
    try {
      await api.post("/api/rag/reindex");
      toast.success("Re-indexing started. This may take a few minutes.");
      q.reload();
    } catch { toast.error("Re-index failed"); }
    setReindexing(false);
  };

  // Feature 3: Export knowledge base summary
  const exportSummary = () => {
    if (!q.data) return;
    const d = q.data;
    const text = `RAG Knowledge Base Summary\n${"=".repeat(40)}\nDocuments: ${d.documents}\nChunks: ${d.chunks}\nEmbeddings: ${d.embeddings}\nQueries: ${d.queries}\nVector DB: ${d.vector_db}\nIndexed: ${d.indexed_pct}%\nAvg Latency: ${d.avg_latency_ms}ms\nCache Hit Rate: ${d.cache_hit_rate}%\n\nTop Document Types:\n${d.top_doc_types.map(t => `  ${t.type}: ${t.count}`).join("\n")}\n\nRecent Queries:\n${d.recent_queries.map(r => `  [${r.mode}] ${r.query} (${r.latency_ms}ms)`).join("\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rag_summary.txt"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Summary exported!");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="RAG Knowledge Base"
        subtitle="Hybrid retrieval — MySQL + Vector store"
        icon={Brain}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={exportSummary} disabled={!q.data}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="btn btn-secondary" onClick={reindex} disabled={reindexing}>
              {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Re-index All
            </button>
            <Link href="/rag/documents" className="btn btn-primary">
              <Upload className="h-4 w-4" /> Upload Documents
            </Link>
          </div>
        }
      />
      <Async q={q} skeleton={<PageSkeleton cards={4} rows={3} />}>
        {(d) => (
          <>
            {/* Feature 1: Stats cards with proper number formatting */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Documents" value={d.documents} icon={FileText} format={num} accent="linear-gradient(135deg,#6366f1,#8b5cf6)" />
              <StatCard label="Chunks" value={d.chunks} icon={BookOpen} format={num} accent="linear-gradient(135deg,#0ea5e9,#38bdf8)" />
              <StatCard label="Embeddings" value={d.embeddings} icon={Zap} format={num} accent="linear-gradient(135deg,#10b981,#34d399)" />
              <StatCard label="Queries" value={d.queries} icon={Search} format={num} accent="linear-gradient(135deg,#f59e0b,#fbbf24)" />
            </div>

            {/* Feature 4: Performance metrics */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-indigo-500" />
                  <div>
                    <p className="text-xs text-slate-500">Avg Latency</p>
                    <p className="text-lg font-bold">{d.avg_latency_ms}ms</p>
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={Math.min(d.avg_latency_ms, 1000)} max={1000} color={d.avg_latency_ms < 300 ? "#10b981" : d.avg_latency_ms < 600 ? "#f59e0b" : "#ef4444"} />
                  <p className="mt-1 text-[10px] text-slate-400">{d.avg_latency_ms < 300 ? "Excellent" : d.avg_latency_ms < 600 ? "Good" : "Needs optimization"}</p>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-xs text-slate-500">Cache Hit Rate</p>
                    <p className="text-lg font-bold">{d.cache_hit_rate}%</p>
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={d.cache_hit_rate} max={100} color="#10b981" />
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="text-xs text-slate-500">Vector Database</p>
                    <p className="text-sm font-semibold">{d.vector_db}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={d.indexed_pct} max={100} />
                  <p className="mt-1 text-[10px] text-slate-400">{d.indexed_pct}% indexed</p>
                </div>
              </Card>
            </div>

            {/* Feature 5: Document type distribution + Query trend */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <SectionTitle title="Document Types" sub="Distribution of indexed documents" />
                <DocTypeDonut data={d.top_doc_types} />
              </Card>
              <Card>
                <SectionTitle title="Query Volume (7 days)" sub="Daily RAG query count" />
                <MiniBarChart data={d.daily_queries} label="" />
              </Card>
            </div>

            {/* Feature 6: Quick action buttons */}
            <Card>
              <SectionTitle title="Quick Actions" sub="Jump to any RAG feature" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "RAG Chat", href: "/ai/rag", icon: MessageSquare, color: "from-indigo-500 to-violet-500" },
                  { label: "Semantic Search", href: "/rag/search", icon: Search, color: "from-sky-500 to-cyan-500" },
                  { label: "Upload Docs", href: "/rag/documents", icon: Upload, color: "from-emerald-500 to-teal-500" },
                  { label: "Debug Retrieval", href: "/rag/retrieval", icon: BarChart3, color: "from-amber-500 to-orange-500" },
                  { label: "Query History", href: "/rag/retrieval", icon: Clock, color: "from-rose-500 to-pink-500" },
                ].map(a => (
                  <Link key={a.label} href={a.href}
                    className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:border-transparent hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
                    <span className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-110", a.color)}>
                      <a.icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-medium">{a.label}</span>
                  </Link>
                ))}
              </div>
            </Card>

            {/* Feature 7: Pipeline architecture */}
            <Card>
              <SectionTitle title="Pipeline Architecture" sub="How your queries are processed" />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                {["User Query", "Query Router", "SQL Agent", "Vector Agent", "Context Fusion", "Groq LLM", "Answer + Citations"].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-2">
                    <span className={cn("rounded-lg px-3 py-1.5 font-medium transition hover:scale-105",
                      i === 0 ? "bg-slate-200 dark:bg-white/10" :
                      i === arr.length - 1 ? "bg-indigo-500 text-white shadow-md" :
                      "bg-slate-100 dark:bg-white/5"
                    )}>{step}</span>
                    {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </span>
                ))}
              </div>
            </Card>

            {/* Feature 8: Recent queries with click-to-debug */}
            {d.recent_queries.length > 0 && (
              <div>
                <SectionTitle title="Recent Queries" action={<Link href="/rag/retrieval" className="text-xs font-medium text-indigo-500">Debug view →</Link>} />
                <div className="mt-3 space-y-2">
                  {d.recent_queries.map((rq) => (
                    <Link key={rq.id} href={`/rag/retrieval?id=${rq.id}`} className="card card-hover flex items-center gap-4 !p-3.5">
                      <Search className="h-4 w-4 shrink-0 text-slate-400" />
                      <p className="min-w-0 flex-1 truncate text-sm">{rq.query}</p>
                      <ModeBadge mode={rq.mode} />
                      <span className="text-xs text-slate-400">{rq.latency_ms}ms</span>
                      <span className="text-xs text-slate-400">{rq.chunks} chunks</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Async>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RAG DOCUMENTS (Features 9-13)
// ══════════════════════════════════════════════════════════════════════════════
const DOC_TYPES = ["receipt", "invoice", "bank_statement", "salary_slip", "tax_document", "credit_card_statement", "investment_statement", "other"];

export function RAGDocuments() {
  const toast = useToast();
  const q = useApi<RagDoc[]>("/api/rag/documents");
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("receipt");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [searchTerm, setSearchTerm] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Feature 9: Upload with progress
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("doc_type", docType);
        await api.post("/api/rag/documents/upload", fd);
        success++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    if (success) toast.success(`${success} document(s) indexed into RAG knowledge base`);
    setUploading(false);
    q.reload();
  };

  // Feature 10: Delete document
  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from knowledge base?`)) return;
    try {
      await api.del(`/api/rag/documents/${id}`);
      toast.success(`${name} removed`);
      q.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  // Feature 11: Filter & sort
  const filtered = useCallback(() => {
    if (!q.data) return [];
    let docs = [...q.data];
    if (filterType !== "all") docs = docs.filter(d => d.doc_type === filterType);
    if (searchTerm) docs = docs.filter(d => d.filename.toLowerCase().includes(searchTerm.toLowerCase()));
    docs.sort((a, b) => {
      if (sortBy === "name") return a.filename.localeCompare(b.filename);
      if (sortBy === "size") return b.char_count - a.char_count;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return docs;
  }, [q.data, filterType, searchTerm, sortBy]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RAG Documents"
        subtitle="Upload financial documents to the knowledge base"
        icon={FileText}
        actions={<Link href="/rag" className="btn btn-secondary">← Dashboard</Link>}
      />

      {/* Feature 9: Upload zone with drag-and-drop visual feedback */}
      <Card>
        <SectionTitle title="Upload Documents" sub="PDF, JPG, PNG, TXT — max 10MB each" />
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            className="input w-52"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            aria-label="Document type"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Indexing…" : "Choose Files"}
          </button>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv"
            onChange={(e) => upload(e.target.files)}
          />
        </div>

        <div
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 text-center transition",
            dragOver
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
              : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-white/15 dark:bg-white/[0.02]"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
          role="button"
          tabIndex={0}
          aria-label="Drop files here"
        >
          <Upload className={cn("mb-2 h-8 w-8", dragOver ? "text-indigo-500" : "text-slate-400")} />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {dragOver ? "Drop to upload!" : "Drop files here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Receipts · Invoices · Bank Statements · PDFs</p>
        </div>
      </Card>

      {/* Feature 11: Filter, search & sort toolbar */}
      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input w-full !pl-9" placeholder="Search documents…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="input w-44" value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Filter by type">
            <option value="all">All Types</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
          <select className="input w-36" value={sortBy} onChange={e => setSortBy(e.target.value as any)} aria-label="Sort by">
            <option value="date">Newest First</option>
            <option value="name">Name A-Z</option>
            <option value="size">Largest First</option>
          </select>
        </div>
      </Card>

      {/* Feature 12: Document list with status and actions */}
      <Async q={q} skeleton={<PageSkeleton rows={4} />}>
        {() => {
          const docs = filtered();
          return docs.length === 0 ? (
            <EmptyState icon={FileText} title="No documents found" body={searchTerm || filterType !== "all" ? "Try adjusting your filters." : "Upload your first document to start building the RAG knowledge base."} />
          ) : (
            <>
              <p className="text-xs text-slate-400">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <Card key={doc.id} className="flex flex-wrap items-center gap-4 !p-4">
                    <span className={cn("grid h-10 w-10 place-items-center rounded-xl text-white",
                      doc.status === "indexed" ? "bg-emerald-500" : doc.status === "error" ? "bg-rose-500" : "bg-amber-500"
                    )}>
                      {doc.status === "indexed" ? <CheckCircle2 className="h-5 w-5" /> : doc.status === "error" ? <AlertTriangle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                    </span>
                    {/* Feature 13: Click to view document details */}
                    <Link href={`/rag/documents/${doc.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium">{doc.filename}</p>
                      <p className="text-xs text-slate-500">
                        {doc.doc_type.replace(/_/g, " ")} · {doc.chunk_count} chunks · {(doc.char_count / 1000).toFixed(1)}k chars · {doc.size_kb}KB · {timeAgo(doc.createdAt)}
                      </p>
                    </Link>
                    <Badge tone={doc.status === "indexed" ? "green" : doc.status === "error" ? "red" : "amber"}>{doc.status}</Badge>
                    <button
                      className="btn btn-ghost btn-sm !text-rose-500"
                      onClick={() => del(doc.id, doc.filename)}
                      aria-label={`Delete ${doc.filename}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Card>
                ))}
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RAG DOCUMENT DETAIL (Feature 14)
// ══════════════════════════════════════════════════════════════════════════════
export function RAGDocumentDetail({ id }: { id: string }) {
  const q = useApi<any>(`/api/rag/documents/${id}`);
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});
  const toast = useToast();

  // Feature 14: Copy chunk text
  const copyChunk = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Chunk copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Document Detail" subtitle="Chunks and extracted text" icon={FileText}
        actions={<Link href="/rag/documents" className="btn btn-secondary">← Documents</Link>} />
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={6} />}>
        {(doc) => (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Chunks" value={doc.chunk_count} icon={BookOpen} format={num} />
              <StatCard label="Characters" value={doc.char_count} icon={FileText} format={num} />
              <Card className="flex flex-col justify-center !p-4">
                <p className="text-xs text-slate-500">Status</p>
                <Badge tone={doc.status === "indexed" ? "green" : "amber"} className="mt-1 w-fit">{doc.status}</Badge>
              </Card>
            </div>

            <Card>
              <SectionTitle title="Raw text preview" />
              <pre className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-slate-100 p-4 text-xs whitespace-pre-wrap dark:bg-white/5">
                {doc.raw_text_preview}
              </pre>
            </Card>

            <Card>
              <SectionTitle title={`${doc.chunks?.length ?? 0} Chunks`} sub="Each chunk is embedded and stored in vector DB" />
              <div className="mt-3 space-y-2">
                {(doc.chunks ?? []).map((c: any) => (
                  <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/[0.03]">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-500">Chunk #{c.index}</span>
                      <span className="text-xs text-slate-400">{c.chars} chars</span>
                      <button onClick={() => copyChunk(c.text)} className="ml-auto text-slate-400 hover:text-indigo-500" title="Copy">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setExpandedChunks(s => ({ ...s, [c.id]: !s[c.id] }))} className="text-slate-400 hover:text-indigo-500" title="Toggle">
                        {expandedChunks[c.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className={cn("text-xs text-slate-600 dark:text-slate-300", !expandedChunks[c.id] && "line-clamp-2")}>{c.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </Async>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RAG SEMANTIC SEARCH (Features 15-17)
// ══════════════════════════════════════════════════════════════════════════════
export function RAGSearch() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [topK, setTopK] = useState(8);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const toast = useToast();

  const SUGGESTIONS = [
    "Find expensive electronics purchases",
    "Show food and dining receipts",
    "Find invoices from Adobe or subscriptions",
    "Show travel and transport documents",
    "Find unusual or large transactions",
    "Show salary slips from last quarter",
    "Find tax-related documents",
    "Show all bank statements",
  ];

  // Feature 15: Semantic search with configurable top_k
  const search = async (query: string) => {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    setSearched(false);
    try {
      const res = await api.get<any>(`/api/rag/search?q=${encodeURIComponent(query)}&top_k=${topK}`);
      setResults(res.results ?? []);
    } catch {
      setResults([]);
    }
    setLoading(false);
    setSearched(true);
  };

  // Feature 16: Bookmark results
  const toggleBookmark = (id: string) => {
    setBookmarked(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); toast.success("Bookmark removed"); }
      else { s.add(id); toast.success("Result bookmarked"); }
      return s;
    });
  };

  // Feature 17: Copy result text
  const copyResult = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Semantic Search" subtitle="Natural language search over your financial documents" icon={Search}
        actions={<Link href="/rag" className="btn btn-secondary">← Dashboard</Link>} />

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Find receipts similar to my laptop purchase…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input w-24" value={topK} onChange={e => setTopK(Number(e.target.value))} aria-label="Results count">
            {[3, 5, 8, 10, 15, 20].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => search(s)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs transition hover:border-indigo-400 hover:text-indigo-600 dark:border-white/10"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {searched && results.length === 0 && (
        <EmptyState icon={Search} title="No results found" body="Try a different query or upload more documents." />
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <SectionTitle title={`${results.length} results`} sub="Ranked by semantic similarity" />
          {results.map((r, i) => (
            <Card key={r.chunk_id} className="!p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-600">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.filename || "Document"}</p>
                  <p className="text-xs text-slate-500">{r.doc_type?.replace(/_/g, " ")} · chunk #{r.chunk_index}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {(r.score * 100).toFixed(0)}% match
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{r.text}</p>
              <div className="mt-3 flex items-center gap-2">
                {r.document_id && (
                  <Link href={`/rag/documents/${r.document_id}`} className="text-xs text-indigo-500 hover:underline">
                    View document →
                  </Link>
                )}
                <div className="ml-auto flex gap-1">
                  <button onClick={() => toggleBookmark(r.chunk_id)} className={cn("rounded-lg p-1.5 transition", bookmarked.has(r.chunk_id) ? "text-amber-500" : "text-slate-400 hover:text-amber-500")} title="Bookmark">
                    <Bookmark className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => copyResult(r.text)} className="rounded-lg p-1.5 text-slate-400 transition hover:text-indigo-500" title="Copy">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RAG CHAT (Features 18-22)
// ══════════════════════════════════════════════════════════════════════════════
type Msg = { id: number; role: "user" | "ai"; text: string; citations?: Citation[]; mode?: string; steps?: string[]; latency?: number; streaming?: boolean; rating?: "up" | "down" | null; bookmarked?: boolean };

const CHAT_SUGGESTIONS = [
  "Maine August se October tak food par kitna spend kiya?",
  "Find all receipt documents related to electronics",
  "Show my subscription spending with citations",
  "Which receipts show unusual or large amounts?",
  "Analyze my shopping expenses and find related documents",
  "Compare my spending across bank statements",
  "What are my top 3 expense categories this month?",
  "Summarize all uploaded tax documents",
];

export function RAGChat() {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([{
    id: 0, role: "ai",
    text: "Hi! 👋 I'm your Hybrid RAG Financial Assistant. I search both your MySQL transactions and uploaded document knowledge base to answer questions.\n\nAsk me anything about your finances!",
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState<Record<number, boolean>>({});
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  // Feature 18: Streaming chat
  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setBusy(true);
    const aiId = idRef.current + 1;
    idRef.current += 2;
    setMsgs((m) => [...m, { id: aiId - 1, role: "user", text: t }, { id: aiId, role: "ai", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/rag/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t }),
      });
      if (!res.ok || !res.body) throw new Error("RAG query failed");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.t === "chunk") {
              setMsgs((m) => m.map((x) => x.id === aiId ? { ...x, text: x.text + ev.v } : x));
            } else if (ev.t === "citations") {
              setMsgs((m) => m.map((x) => x.id === aiId ? { ...x, citations: ev.v } : x));
            } else if (ev.t === "meta") {
              setMsgs((m) => m.map((x) => x.id === aiId ? { ...x, mode: ev.v.mode, steps: ev.v.steps } : x));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setMsgs((m) => m.map((x) => x.id === aiId ? { ...x, text: e instanceof Error ? e.message : "Something went wrong." } : x));
      toast.error("RAG query failed");
    }
    setMsgs((m) => m.map((x) => x.id === aiId ? { ...x, streaming: false } : x));
    setBusy(false);
  };

  // Feature 19: Rate answers
  const rateMsg = (msgId: number, rating: "up" | "down") => {
    setMsgs(m => m.map(x => x.id === msgId ? { ...x, rating: x.rating === rating ? null : rating } : x));
    toast.success(rating === "up" ? "Thanks for the feedback! 👍" : "Noted, we'll improve 🙏");
  };

  // Feature 20: Copy answer
  const copyMsg = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Answer copied");
  };

  // Feature 21: Bookmark answer
  const bookmarkMsg = (msgId: number) => {
    setMsgs(m => m.map(x => x.id === msgId ? { ...x, bookmarked: !x.bookmarked } : x));
    toast.success("Toggled bookmark");
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] min-h-[480px] max-w-4xl flex-col md:h-[calc(100dvh-11rem)]">
      <PageHeader
        title="RAG Financial Chat"
        subtitle="Hybrid SQL + Vector retrieval with source citations"
        icon={Brain}
        actions={
          <>
            <Link href="/rag" className="btn btn-secondary btn-sm"><Database className="h-4 w-4" /> Knowledge Base</Link>
            <button className="btn btn-ghost btn-sm" onClick={() => setMsgs(msgs.slice(0, 1))} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </>
        }
      />

      <div className="card flex flex-1 flex-col overflow-hidden !p-0">
        {/* Messages */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full",
                m.role === "ai" ? "bg-grad text-white" : "bg-slate-200 dark:bg-white/15"
              )}>
                {m.role === "ai" ? <Brain className="h-4 w-4" /> : <span className="text-xs font-bold">K</span>}
              </span>

              <div className={cn("max-w-[88%] space-y-2 rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user" ? "bg-grad text-white" : "bg-slate-100 dark:bg-white/[0.07]"
              )}>
                {/* Mode badge */}
                {m.mode && <ModeBadge mode={m.mode} />}

                {/* Text */}
                {m.text && (
                  <p className="whitespace-pre-wrap">
                    {m.text}
                    {m.streaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />}
                  </p>
                )}

                {/* Citations */}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      📚 Sources ({m.citations.length})
                    </p>
                    {m.citations.map((c, i) => <CitationCard key={i} c={c} i={i + 1} />)}
                  </div>
                )}

                {/* Agent steps toggle */}
                {m.steps && m.steps.length > 0 && (
                  <div>
                    <button
                      className="text-xs text-indigo-500 hover:underline"
                      onClick={() => setShowSteps((s) => ({ ...s, [m.id]: !s[m.id] }))}
                    >
                      {showSteps[m.id] ? "Hide" : "Show"} agent steps ({m.steps.length})
                    </button>
                    {showSteps[m.id] && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-400">
                        {m.steps.map((step, i) => <li key={i} className="flex gap-1.5"><span className="text-indigo-400">→</span>{step}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Feature 19-21: Action bar for AI messages */}
                {m.role === "ai" && m.id > 0 && !m.streaming && m.text && (
                  <div className="mt-2 flex items-center gap-1 border-t border-slate-200/50 pt-2 dark:border-white/5">
                    <button onClick={() => rateMsg(m.id, "up")} className={cn("rounded-lg p-1.5 transition", m.rating === "up" ? "text-emerald-500" : "text-slate-400 hover:text-emerald-500")} title="Good answer">
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => rateMsg(m.id, "down")} className={cn("rounded-lg p-1.5 transition", m.rating === "down" ? "text-rose-500" : "text-slate-400 hover:text-rose-500")} title="Bad answer">
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => copyMsg(m.text)} className="rounded-lg p-1.5 text-slate-400 transition hover:text-indigo-500" title="Copy">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => bookmarkMsg(m.id)} className={cn("rounded-lg p-1.5 transition", m.bookmarked ? "text-amber-500" : "text-slate-400 hover:text-amber-500")} title="Bookmark">
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Feature 22: Input with suggestion chips */}
        <div className="border-t border-slate-200/70 p-3 sm:p-4 dark:border-white/10">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {CHAT_SUGGESTIONS.map((s) => (
              <button key={s} disabled={busy} onClick={() => send(s)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask anything — I'll search MySQL + your documents…"
              className="input max-h-32 min-h-11 flex-1 resize-none"
              aria-label="Message"
            />
            <button type="submit" className="btn btn-primary !px-4" disabled={busy || !input.trim()} aria-label="Send">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RAG RETRIEVAL DEBUG (Features 23-25)
// ══════════════════════════════════════════════════════════════════════════════
export function RAGRetrieval() {
  const [queryId, setQueryId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const q = useApi<RagStats>("/api/rag/stats");
  const toast = useToast();

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await api.get(`/api/rag/retrieval/${id}`));
    } catch {
      setData(null);
      toast.error("Query not found");
    }
    setLoading(false);
  };

  // Feature 23: Copy debug info
  const copyDebug = () => {
    if (!data) return;
    const text = `Query: ${data.query}\nMode: ${data.mode}\nLatency: ${data.latency_ms}ms\nSQL used: ${data.sql_used ? "Yes" : "No"}\nChunks: ${data.chunks_retrieved}\n\nAnswer: ${data.answer}\n\nChunks:\n${(data.retrieved_chunks ?? []).map((c: any, i: number) => `${i + 1}. [${c.score.toFixed(3)}] ${c.filename}: ${c.text}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    toast.success("Debug info copied");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Retrieval Debugger" subtitle="Inspect what the RAG pipeline retrieved for any query" icon={BarChart3}
        actions={<Link href="/rag" className="btn btn-secondary">← Dashboard</Link>} />

      <Card>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Enter query ID…" value={queryId} onChange={(e) => setQueryId(e.target.value)} />
          <button className="btn btn-primary" onClick={() => load(queryId)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Inspect
          </button>
        </div>
      </Card>

      {/* Feature 24: Click recent queries to debug */}
      <Async q={q} skeleton={<PageSkeleton rows={3} />}>
        {(stats) => stats.recent_queries.length > 0 ? (
          <Card>
            <SectionTitle title="Recent Queries — click to inspect" />
            <div className="mt-3 space-y-2">
              {stats.recent_queries.map((rq) => (
                <button key={rq.id} onClick={() => { setQueryId(String(rq.id)); load(String(rq.id)); }}
                  className="flex w-full items-center gap-4 rounded-xl border border-slate-100 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-white/5 dark:hover:bg-white/5"
                >
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-sm">{rq.query}</span>
                  <ModeBadge mode={rq.mode} />
                  <span className="text-xs text-slate-400">{rq.latency_ms}ms</span>
                </button>
              ))}
            </div>
          </Card>
        ) : null}
      </Async>

      {/* Feature 25: Debug results view with copy */}
      {data && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold">{data.query}</p>
                <p className="text-sm text-slate-500">Latency: {data.latency_ms}ms · SQL: {data.sql_used ? "yes" : "no"} · Chunks: {data.chunks_retrieved}</p>
              </div>
              <ModeBadge mode={data.mode} />
              <button onClick={copyDebug} className="btn btn-ghost btn-sm" title="Copy debug info">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Answer" />
            <p className="mt-2 whitespace-pre-wrap text-sm">{data.answer}</p>
          </Card>

          {data.retrieved_chunks?.length > 0 && (
            <Card>
              <SectionTitle title={`${data.retrieved_chunks.length} Retrieved Chunks`} sub="Ranked by similarity score" />
              <div className="mt-3 space-y-3">
                {data.retrieved_chunks.map((c: any, i: number) => (
                  <div key={c.chunk_id} className="rounded-xl border border-slate-100 p-3 dark:border-white/5">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-indigo-500/10 text-xs font-bold text-indigo-600">{i + 1}</span>
                      <p className="flex-1 text-sm font-medium">{c.filename}</p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        {c.score.toFixed(3)}
                      </span>
                      {/* Similarity bar */}
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.score * 100}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{c.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
