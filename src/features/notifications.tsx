"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Search as SearchIcon, Trash2 } from "lucide-react";
import { Async, Card, EmptyState, ListSkeleton, PageHeader, Segmented } from "@/components/ui";
import { NOTIF_COLOR, NOTIF_ICON } from "@/components/notifications/NotificationBell";
import { useConfirm, useToast } from "@/components/feedback";
import { api, useApi, useDebounce } from "@/hooks/useApi";
import { cn, timeAgo } from "@/lib/format";
import type { Notif } from "@/lib/types";
import { Info } from "lucide-react";

export function Notifications() {
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<Notif[]>("/api/resources/notifications");
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState<Notif[] | null>(null);
  useEffect(() => setRows(q.data), [q.data]);
  const read = async (n: Notif) => {
    if (n.read) return;
    setRows((p) => p?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
    await api.patch(`/api/resources/notifications/${n.id}`, { read: true });
  };
  const list = (rows ?? []).filter((n) => filter === "all" || (filter === "unread" ? !n.read : n.type === filter));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Notifications" subtitle={`${(rows ?? []).filter((n) => !n.read).length} unread`} icon={Bell} actions={<><button className="btn btn-secondary" onClick={async () => { await api.patch("/api/resources/notifications", { set: { read: true } }); toast.success("All marked as read"); q.reload(); }}><CheckCheck className="h-4 w-4" /> Mark all read</button><button className="btn btn-ghost !text-rose-500" onClick={async () => { if (await confirm({ title: "Clear all notifications?", confirmText: "Clear all", danger: true })) { await api.del("/api/resources/notifications"); toast.success("Cleared"); q.reload(); } }}><Trash2 className="h-4 w-4" /> Clear</button></>} />
      <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }, { value: "alert", label: "Alerts" }, { value: "warning", label: "Warnings" }, { value: "info", label: "Info" }]} />
      <Async q={{ ...q, data: rows }} skeleton={<ListSkeleton rows={5} />}>
        {() => list.length === 0 ? <EmptyState icon={Bell} title="Nothing here" body="You're all caught up 🎉" /> : (
          <div className="space-y-3">{list.map((n) => {
            const Icon = NOTIF_ICON[n.type as keyof typeof NOTIF_ICON] ?? Info;
            return (
              <Card key={n.id} onClick={() => read(n)} className={cn("flex cursor-pointer items-start gap-4 !p-4", !n.read && "!border-indigo-300/60 bg-indigo-50/50 dark:!border-indigo-500/30")}>
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", NOTIF_COLOR[n.type as keyof typeof NOTIF_COLOR])}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="font-semibold">{n.title} {!n.read && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />}</p><p className="text-sm text-slate-500">{n.body}</p><p className="mt-1 text-xs text-slate-400">{timeAgo(n.createdAt)}</p></div>
                <button className="btn btn-ghost btn-sm" aria-label="Delete notification" onClick={async (e) => { e.stopPropagation(); await api.del(`/api/resources/notifications/${n.id}`); setRows((p) => p?.filter((x) => x.id !== n.id) ?? null); }}><Trash2 className="h-4 w-4" /></button>
              </Card>
            );
          })}</div>
        )}
      </Async>
    </div>
  );
}

type Result = { type: string; id: number; title: string; subtitle: string; href: string; amount?: number };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("q");
    if (p) setQ(p);
  }, []);
  const dq = useDebounce(q.trim(), 250);
  const res = useApi<{ results: Result[] }>(dq ? `/api/search?q=${encodeURIComponent(dq)}` : null);
  const groups = new Map<string, Result[]>();
  for (const r of res.data?.results ?? []) groups.set(r.type, [...(groups.get(r.type) ?? []), r]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Search" subtitle="Transactions, bills, subscriptions, goals, scans and more" icon={SearchIcon} />
      <div className="relative"><SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" /><input autoFocus className="input !py-3.5 !pl-12 !text-base" placeholder="Search anything…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div>
      {!dq ? (
        <div><p className="mb-3 text-sm text-slate-500">Try searching for</p><div className="flex flex-wrap gap-2">{["Amazon", "Food", "Netflix", "Electricity", "Goa", "Salary"].map((s) => <button key={s} onClick={() => setQ(s)} className="cursor-pointer rounded-full border border-slate-200 px-3.5 py-1.5 text-sm hover:border-indigo-400 dark:border-white/10">{s}</button>)}</div></div>
      ) : !res.data && !res.error ? <ListSkeleton rows={4} h="h-14" /> : res.data && res.data.results.length === 0 ? <EmptyState icon={SearchIcon} title={`No results for “${dq}”`} body="Check the spelling or try a broader term." /> : (
        <div className="space-y-6">{[...groups.entries()].map(([type, items]) => (
          <div key={type}><p className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">{type}s · {items.length}</p>
            <div className="card divide-y divide-slate-100 !p-0 dark:divide-white/5">{items.map((r) => <Link key={`${r.type}-${r.id}`} href={r.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/5"><div className="min-w-0 flex-1"><p className="truncate font-medium">{r.title}</p><p className="truncate text-xs text-slate-500">{r.subtitle}</p></div>{r.amount !== undefined && <span className={cn("money font-semibold", r.amount > 0 && "text-emerald-600")}>{r.amount > 0 ? "+" : "-"}₹{Math.abs(r.amount).toLocaleString("en-IN")}</span>}</Link>)}</div>
          </div>))}</div>
      )}
    </div>
  );
}
