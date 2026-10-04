"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, ShieldAlert, Sparkles } from "lucide-react";
import { CatIcon } from "@/components/ui";
import { cn, fmtDate, money } from "@/lib/format";
import type { Insight, Txn } from "@/lib/types";

export function TxnRow({ t }: { t: Txn }) {
  const base = t.type === "income" ? "income" : "expenses";
  return (
    <Link href={`/${base}/${t.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-100/70 dark:hover:bg-white/5">
      <CatIcon name={t.category} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{t.merchant}</p>
        <p className="truncate text-xs text-slate-500">{t.category} · {fmtDate(t.date)}</p>
      </div>
      <span className={cn("money font-semibold tabular-nums", t.type === "income" && "text-emerald-600 dark:text-emerald-400")}>{money(t.type === "income" ? t.amount : -t.amount, { sign: true })}</span>
    </Link>
  );
}

const STYLE = {
  warning: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-500" },
  alert: { icon: ShieldAlert, cls: "bg-rose-500/10 text-rose-500" },
  info: { icon: Info, cls: "bg-sky-500/10 text-sky-500" },
  success: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-500" },
  tip: { icon: Lightbulb, cls: "bg-violet-500/10 text-violet-500" },
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const s = STYLE[insight.type];
  const body = (
    <div className="flex gap-3.5 rounded-2xl border border-slate-200/70 bg-white/60 p-4 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03]">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", s.cls)}>
        <s.icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{insight.title}</p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{insight.body}</p>
      </div>
    </div>
  );
  return insight.href ? <Link href={insight.href} className="block">{body}</Link> : body;
}

export function AiBadge({ children = "AI" }: { children?: React.ReactNode }) {
  return (
    <span className="bg-grad inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
      <Sparkles className="h-3 w-3" /> {children}
    </span>
  );
}
