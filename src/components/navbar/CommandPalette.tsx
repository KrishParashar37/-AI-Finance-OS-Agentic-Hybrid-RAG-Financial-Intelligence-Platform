"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, FileText, Moon, Plus, ScanLine, Search, Sparkles, Keyboard, type LucideIcon } from "lucide-react";
import { usePalette, useSettings } from "@/components/providers";
import { useApi, useDebounce } from "@/hooks/useApi";
import { PAGES } from "@/lib/nav";
import { cn } from "@/lib/format";

type Item = { id: string; label: string; sub?: string; group: string; icon: LucideIcon; run: () => void };
type Result = { type: string; id: number; title: string; subtitle: string; href: string };

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { toggleTheme } = useSettings();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const dq = useDebounce(q, 200);
  const listRef = useRef<HTMLDivElement>(null);
  const search = useApi<{ results: Result[] }>(dq.trim() ? `/api/search?q=${encodeURIComponent(dq.trim())}` : null);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const actions: Item[] = [
      { id: "a-scan", label: "Scan a receipt", group: "Quick actions", icon: ScanLine, run: () => go("/scanner") },
      { id: "a-exp", label: "Add expense", group: "Quick actions", icon: Plus, run: () => go("/expenses/new") },
      { id: "a-inc", label: "Add income", group: "Quick actions", icon: Plus, run: () => go("/income/new") },
      { id: "a-ai", label: "Ask the AI assistant", group: "Quick actions", icon: Sparkles, run: () => go("/ai") },
      { id: "a-rep", label: "Generate a report", group: "Quick actions", icon: FileText, run: () => go("/reports/generate") },
      { id: "a-theme", label: "Toggle dark / light mode", group: "Quick actions", icon: Moon, run: () => { toggleTheme(); onClose(); } },
      { id: "a-keys", label: "Keyboard shortcuts", group: "Quick actions", icon: Keyboard, run: () => { onClose(); window.dispatchEvent(new Event("show-shortcuts")); } },
    ].filter((a) => !term || a.label.toLowerCase().includes(term));
    const pages: Item[] = PAGES.filter((p) => !term || `${p.label} ${p.group} ${p.keywords ?? ""}`.toLowerCase().includes(term))
      .slice(0, term ? 8 : 6)
      .map((p) => ({ id: `p-${p.href}`, label: p.label, sub: p.group, group: "Pages", icon: Search, run: () => go(p.href) }));
    const res: Item[] = term
      ? (search.data?.results ?? []).slice(0, 8).map((r) => ({ id: `r-${r.type}-${r.id}`, label: r.title, sub: `${r.type} · ${r.subtitle}`, group: "Results", icon: Search, run: () => go(r.href) }))
      : [];
    const all: Item[] = term ? [{ id: "s-all", label: `Search everything for “${q.trim()}”`, group: "Search", icon: Search, run: () => go(`/search?q=${encodeURIComponent(q.trim())}`) }] : [];
    return [...all, ...res, ...actions, ...pages];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, search.data]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[idx]?.run();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[96] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <motion.div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-white/10">
          <Search className="h-5 w-5 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search transactions, pages, actions…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" aria-label="Command palette search" />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-white/10">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No matches</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{header}</p>}
                <button data-idx={i} onMouseEnter={() => setIdx(i)} onClick={it.run} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === idx ? "bg-indigo-50 dark:bg-white/10" : "")}>
                  <it.icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.sub && <span className="truncate text-xs text-slate-400">{it.sub}</span>}
                  {i === idx && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" />}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  return <AnimatePresence>{open && <Palette key="palette" onClose={() => setOpen(false)} />}</AnimatePresence>;
}
