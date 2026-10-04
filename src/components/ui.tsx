"use client";
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { animate, motion } from "framer-motion";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { cn, money, pctText } from "@/lib/format";
import { catMeta } from "@/lib/constants";
import type { Query } from "@/hooks/useApi";

export function Card({ className, children, hover, ...rest }: { className?: string; children: ReactNode; hover?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5", hover && "card-hover", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, action, sub }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="bg-grad grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function PageSkeleton({ cards = 3, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5, h = "h-16" }: { rows?: number; h?: string }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={h} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-white/15">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center dark:border-rose-500/20 dark:bg-rose-500/5">
      <AlertTriangle className="mb-3 h-8 w-8 text-rose-500" />
      <h3 className="font-semibold">Something went wrong</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary mt-4">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function Async<T>({ q, skeleton, children }: { q: Pick<Query<T>, "data" | "error" | "reload">; skeleton?: ReactNode; children: (d: T) => ReactNode }) {
  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reload} />;
  if (!q.data) return <>{skeleton ?? <PageSkeleton />}</>;
  return <>{children(q.data)}</>;
}

const TONES = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("badge", TONES[tone], className)}>{children}</span>;
}

export function statusTone(s: string): Tone {
  if (["paid", "active", "completed", "saved", "ready", "low"].includes(s)) return "green";
  if (["overdue", "high", "cancelled", "failed"].includes(s)) return "red";
  if (["pending", "upcoming", "medium", "paused", "processed"].includes(s)) return "amber";
  return "slate";
}

export function ProgressBar({ value, max = 100, color, warn = true, className }: { value: number; max?: number; color?: string; warn?: boolean; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const over = pct > 100;
  const bg = over && warn ? "#ef4444" : pct > 85 && warn ? "#f59e0b" : color;
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn("h-full rounded-full", !bg && "bg-grad")} style={bg ? { background: bg } : undefined} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
    </div>
  );
}

export function Counter({ value, format = (n: number) => money(n), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const c = animate(prev.current, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setShown(v) });
    prev.current = value;
    return () => c.stop();
  }, [value]);
  return <span className={cn("money tabular-nums", className)}>{format(shown)}</span>;
}

export function DeltaChip({ value, goodWhenDown }: { value: number | null | undefined; goodWhenDown?: boolean }) {
  if (value === null || value === undefined) return <span className="text-xs text-slate-400">no prior data</span>;
  const up = value >= 0;
  const good = goodWhenDown ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold", good ? TONES.green : TONES.red)}>
      <Icon className="h-3 w-3" />
      {pctText(value)}
    </span>
  );
}

export function StatCard({ label, value, delta, goodWhenDown, icon: Icon, sub, format, accent }: { label: string; value: number; delta?: number | null; goodWhenDown?: boolean; icon: LucideIcon; sub?: string; format?: (n: number) => string; accent?: string }) {
  return (
    <Card hover className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-2 text-2xl font-bold tracking-tight sm:text-[1.7rem]">
            <Counter value={value} format={format} />
          </div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: accent ?? "linear-gradient(135deg,var(--ac1),var(--ac2))" }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        {delta !== undefined && <DeltaChip value={delta} goodWhenDown={goodWhenDown} />}
        {sub && <span>{sub}</span>}
      </div>
    </Card>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = "md" }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("cursor-pointer rounded-lg font-medium transition", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm", value === o.value ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group/tt relative flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition group-hover/tt:opacity-100 dark:bg-white dark:text-slate-900">
        {text}
      </span>
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition", checked ? "bg-grad" : "bg-slate-300 dark:bg-white/20")}>
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

export function CatIcon({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const m = catMeta(name);
  const s = { sm: "h-8 w-8 text-sm", md: "h-10 w-10 text-lg", lg: "h-12 w-12 text-2xl" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", s)} style={{ background: `${m.color}22` }} aria-hidden>
      {m.emoji}
    </span>
  );
}

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return <p className="text-xs text-slate-500">{total} result{total === 1 ? "" : "s"}</p>;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Page {page} of {pages} · {total} results
      </p>
      <div className="flex items-center gap-1">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-slate-400">…</span>}
            <button onClick={() => onChange(n)} className={cn("btn btn-sm !px-2.5", n === page ? "btn-primary" : "btn-ghost")}>
              {n}
            </button>
          </span>
        ))}
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export type MenuItem = { label: string; icon?: LucideIcon; onClick: () => void; danger?: boolean };

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - 210) : x;
  const top = typeof window !== "undefined" ? Math.min(y, window.innerHeight - items.length * 40 - 20) : y;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ left, top }} className="fixed z-[95] w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-slate-900" role="menu" onClick={(e) => e.stopPropagation()}>
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          onClick={() => {
            it.onClick();
            onClose();
          }}
          className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-white/10", it.danger && "text-rose-600 hover:bg-rose-50 dark:text-rose-400")}
        >
          {it.icon && <it.icon className="h-4 w-4" />}
          {it.label}
        </button>
      ))}
    </motion.div>
  );
}
