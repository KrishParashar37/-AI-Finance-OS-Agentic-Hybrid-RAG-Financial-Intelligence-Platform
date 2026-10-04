"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Download, Edit3, Eye, Filter, Loader2, Plus, Repeat, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { api, request, useDebounce } from "@/hooks/useApi";
import { useConfirm, useToast } from "@/components/feedback";
import { Drawer } from "@/components/modals/Modal";
import { DateRangePicker, Field, MultiSelect } from "@/components/forms";
import { Badge, CatIcon, ContextMenu, EmptyState, ErrorState, Pagination, Segmented, Skeleton, type MenuItem } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { cn, fmtDate, money } from "@/lib/format";
import type { Txn, TxnList } from "@/lib/types";

type Filters = { category: string[]; payment: string[]; risk: string[]; from: string; to: string; min: string; max: string };
const EMPTY: Filters = { category: [], payment: [], risk: [], from: "", to: "", min: "", max: "" };

export function TransactionExplorer({ type, extra, hideAdd, pageSize = 15 }: { type: "expense" | "income" | "all"; extra?: Record<string, string>; hideAdd?: boolean; pageSize?: number }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const base = type === "income" ? "income" : "expenses";
  const rowBase = (t: Txn) => (t.type === "income" ? "income" : "expenses");
  const cats = type === "income" ? INCOME_CATEGORIES : type === "all" ? [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] : EXPENSE_CATEGORIES;

  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"pages" | "infinite">("pages");
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; t: Txn } | null>(null);
  const [items, setItems] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const req = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams({ ...(type !== "all" ? { type } : {}), sort, dir, limit: String(pageSize), ...(extra ?? {}) });
    if (dq) p.set("q", dq);
    if (f.category.length) p.set("category", f.category.join(","));
    if (f.payment.length) p.set("payment", f.payment.join(","));
    if (f.risk.length) p.set("risk", f.risk.join(","));
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.min) p.set("min", f.min);
    if (f.max) p.set("max", f.max);
    return p;
  }, [type, sort, dir, dq, f, extra, pageSize]);

  const paramKey = params.toString();
  const lastKey = useRef(paramKey);
  useEffect(() => {
    if (lastKey.current !== paramKey) {
      lastKey.current = paramKey;
      setPage(1);
      setSelected(new Set());
    }
  }, [paramKey]);

  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    request<TxnList>(`/api/transactions?${paramKey}&page=${page}`)
      .then((res) => {
        if (id !== req.current) return;
        setItems((prev) => (mode === "infinite" && page > 1 ? [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))] : res.items));
        setTotal(res.total);
        setSum(res.sum);
        setError(null);
      })
      .catch((e) => id === req.current && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => id === req.current && setLoading(false));
  }, [paramKey, page, mode, tick]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (mode !== "infinite" || !sentinel.current) return;
    const el = sentinel.current;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !loading && page < pages) setPage((p) => p + 1);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [mode, loading, page, pages]);

  const refresh = useCallback(() => {
    setPage(1);
    setSelected(new Set());
    setTick((t) => t + 1);
  }, []);

  const toggleSort = (key: string) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("desc");
    }
  };
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = async (action: string, category?: string) => {
    const ids = [...selected];
    if (action === "delete" && !(await confirm({ title: `Delete ${ids.length} transaction${ids.length > 1 ? "s" : ""}?`, message: "This cannot be undone and account balances will be adjusted.", confirmText: "Delete", danger: true }))) return;
    try {
      await api.post("/api/transactions/bulk", { action, ids, category });
      toast.success(action === "delete" ? "Deleted" : "Updated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const del = async (t: Txn) => {
    if (!(await confirm({ title: "Delete transaction?", message: `${t.merchant} · ${money(t.amount)} will be removed permanently.`, confirmText: "Delete", danger: true }))) return;
    try {
      await api.del(`/api/transactions/${t.id}`);
      toast.success("Transaction deleted");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const exportCsv = async () => {
    try {
      const res = await request<TxnList>(`/api/transactions?${paramKey}&limit=200&page=1`);
      const rows = [["Date", "Merchant", "Category", "Payment", "Amount", "Tax", "Notes"], ...res.items.map((t) => [fmtDate(t.date), t.merchant, t.category, t.paymentMethod, String(t.amount), String(t.tax), t.notes])];
      const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `${base}-export.csv`;
      a.click();
      toast.success(`Exported ${res.items.length} rows`);
    } catch {
      toast.error("Export failed");
    }
  };

  const menuItems = (t: Txn): MenuItem[] => [
    { label: "View details", icon: Eye, onClick: () => router.push(`/${rowBase(t)}/${t.id}`) },
    { label: "Edit", icon: Edit3, onClick: () => router.push(`/${rowBase(t)}/${t.id}?edit=1`) },
    { label: "Mark recurring", icon: Repeat, onClick: () => api.patch(`/api/transactions/${t.id}`, { recurring: true }).then(() => { toast.success("Marked as recurring"); refresh(); }) },
    { label: "Delete", icon: Trash2, danger: true, onClick: () => del(t) },
  ];

  const activeCount = Object.values(f).filter((v) => (Array.isArray(v) ? v.length : v)).length;
  const SortHead = ({ k, label, className }: { k: string; label: string; className?: string }) => (
    <button onClick={() => toggleSort(k)} className={cn("flex cursor-pointer items-center gap-1 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-800 dark:hover:text-slate-200", className)}>
      {label}
      {sort === k && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-10" placeholder={`Search ${type === "income" ? "income" : type === "all" ? "transactions" : "expenses"}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
        </div>
        <button className="btn btn-secondary" onClick={() => { setDraft(f); setDrawer(true); }}>
          <Filter className="h-4 w-4" /> Filters {activeCount > 0 && <span className="bg-grad grid h-5 w-5 place-items-center rounded-full text-[10px] text-white">{activeCount}</span>}
        </button>
        <Segmented size="sm" value={mode} onChange={(m) => { setMode(m); setPage(1); }} options={[{ value: "pages", label: "Pages" }, { value: "infinite", label: "Infinite" }]} />
        <button className="btn btn-secondary" onClick={exportCsv}><Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span></button>
        {!hideAdd && <Link href={`/${base}/new`} className="btn btn-primary"><Plus className="h-4 w-4" /> Add</Link>}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {f.category.map((c) => <Badge key={c} tone="violet">{c}<button aria-label={`Remove ${c}`} onClick={() => setF({ ...f, category: f.category.filter((x) => x !== c) })}><X className="h-3 w-3" /></button></Badge>)}
          {f.payment.map((c) => <Badge key={c} tone="blue">{c}<button aria-label={`Remove ${c}`} onClick={() => setF({ ...f, payment: f.payment.filter((x) => x !== c) })}><X className="h-3 w-3" /></button></Badge>)}
          {(f.from || f.to) && <Badge>{f.from ? fmtDate(f.from) : "…"} → {f.to ? fmtDate(f.to) : "…"}<button aria-label="Clear dates" onClick={() => setF({ ...f, from: "", to: "" })}><X className="h-3 w-3" /></button></Badge>}
          {(f.min || f.max) && <Badge>{f.min || 0} – {f.max || "∞"}<button aria-label="Clear amount" onClick={() => setF({ ...f, min: "", max: "" })}><X className="h-3 w-3" /></button></Badge>}
          <button className="text-xs font-medium text-indigo-500 hover:underline" onClick={() => setF(EMPTY)}>Clear all</button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bg-grad flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lg">
          <span className="font-semibold">{selected.size} selected</span>
          <select className="rounded-lg bg-white/20 px-2 py-1 text-xs outline-none" value="" onChange={(e) => e.target.value && bulk("category", e.target.value)} aria-label="Change category">
            <option value="">Change category…</option>
            {cats.map((c) => <option key={c} value={c} className="text-slate-900">{c}</option>)}
          </select>
          <button className="rounded-lg bg-white/20 px-2.5 py-1 text-xs hover:bg-white/30" onClick={() => bulk("recurring")}>Mark recurring</button>
          <button className="rounded-lg bg-rose-500/80 px-2.5 py-1 text-xs hover:bg-rose-500" onClick={() => bulk("delete")}>Delete</button>
          <button className="ml-auto text-xs underline" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="card overflow-hidden !p-0">
        <div className="hidden items-center gap-4 border-b border-slate-200/70 bg-slate-50/60 px-4 py-3 md:flex dark:border-white/10 dark:bg-white/[0.03]">
          <input type="checkbox" className="h-4 w-4 accent-indigo-500" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))} aria-label="Select all" />
          <SortHead k="merchant" label={type === "income" ? "Source" : "Merchant"} className="flex-1" />
          <SortHead k="category" label="Category" className="w-36" />
          <SortHead k="date" label="Date" className="w-28" />
          <span className="w-28 text-xs font-semibold tracking-wide text-slate-500 uppercase">Payment</span>
          <SortHead k="amount" label="Amount" className="w-28 justify-end" />
        </div>
        {error && !items.length ? (
          <div className="p-4"><ErrorState message={error} onRetry={refresh} /></div>
        ) : loading && !items.length ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : items.length === 0 ? (
          <div className="p-4"><EmptyState title="No transactions found" body={activeCount || q ? "Try adjusting your search or filters." : `Add your first ${type} to get started.`} action={!hideAdd ? <Link href={`/${base}/new`} className="btn btn-primary">Add {type}</Link> : undefined} /></div>
        ) : (
          <ul className={cn("divide-y divide-slate-100 dark:divide-white/5", loading && "opacity-60 transition")}>
            {items.map((t) => (
              <li key={t.id} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, t }); }} className={cn("group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 md:gap-4 dark:hover:bg-white/[0.04]", selected.has(t.id) && "bg-indigo-50/70 dark:bg-indigo-500/10")}>
                <input type="checkbox" className="h-4 w-4 accent-indigo-500" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.merchant}`} />
                <Link href={`/${rowBase(t)}/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <CatIcon name={t.category} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {t.merchant}
                      {t.risk !== "low" && <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", t.risk === "high" ? "text-rose-500" : "text-amber-500")} aria-label={`${t.risk} risk`} />}
                      {t.recurring && <Repeat className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-label="Recurring" />}
                      {t.source === "scan" && <Badge tone="violet" className="hidden sm:inline-flex">scan</Badge>}
                    </p>
                    <p className="truncate text-xs text-slate-500 md:hidden">{t.category} · {fmtDate(t.date)} · {t.paymentMethod}</p>
                  </div>
                </Link>
                <span className="hidden w-36 text-sm text-slate-600 md:block dark:text-slate-300">{t.category}</span>
                <span className="hidden w-28 text-sm text-slate-500 md:block">{fmtDate(t.date)}</span>
                <span className="hidden w-28 text-sm text-slate-500 md:block">{t.paymentMethod}</span>
                <span className={cn("money w-24 text-right font-semibold tabular-nums md:w-28", t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "")}>{money(t.type === "income" ? t.amount : -t.amount, { sign: true })}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-slate-100 px-4 py-3 dark:border-white/10">
          {mode === "pages" ? (
            <Pagination page={page} pages={pages} total={total} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          ) : (
            <div ref={sentinel} className="flex items-center justify-center gap-2 py-1 text-xs text-slate-500">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : page < pages ? "Scroll for more" : `All ${total} loaded`}
            </div>
          )}
        </div>
      </div>
      <p className="text-right text-xs text-slate-500">
        {total} transactions · total <span className="money font-semibold">{money(sum)}</span>
      </p>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.t)} onClose={() => setMenu(null)} />}

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Filters">
        <div className="space-y-5">
          <Field label="Categories"><MultiSelect options={cats} value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} placeholder="All categories" /></Field>
          <Field label="Payment methods"><MultiSelect options={PAYMENT_METHODS} value={draft.payment} onChange={(v) => setDraft({ ...draft, payment: v })} placeholder="All methods" /></Field>
          <Field label="Date range"><DateRangePicker from={draft.from} to={draft.to} onChange={(from, to) => setDraft({ ...draft, from, to })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min amount"><input className="input" type="number" min="0" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} /></Field>
            <Field label="Max amount"><input className="input" type="number" min="0" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value })} /></Field>
          </div>
          {type !== "income" && <Field label="Risk level"><MultiSelect options={["low", "medium", "high"]} value={draft.risk} onChange={(v) => setDraft({ ...draft, risk: v })} placeholder="Any risk" /></Field>}
          <div className="flex gap-2 pt-2">
            <button className="btn btn-secondary flex-1" onClick={() => { setDraft(EMPTY); setF(EMPTY); setDrawer(false); }}>Reset</button>
            <button className="btn btn-primary flex-1" onClick={() => { setF(draft); setDrawer(false); }}>Apply filters</button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
