"use client";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compact, money, cn } from "@/lib/format";
import { catMeta } from "@/lib/constants";

export const COLORS = { expense: "#8b5cf6", income: "#10b981", net: "#0ea5e9", forecast: "#f59e0b", grid: "rgba(148,163,184,0.18)", tick: "#94a3b8" };

type TipProps = { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string };
function ChartTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
      <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name ?? p.dataKey}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums">{money(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

const axis = { tick: { fill: COLORS.tick, fontSize: 11 }, axisLine: false, tickLine: false } as const;

export function SpendingChart({ data, height = 300, showIncome = true, type = "area" }: { data: { label: string; expense: number; income: number }[]; height?: number; showIncome?: boolean; type?: "area" | "bar" }) {
  const interval = Math.max(0, Math.ceil(data.length / 8) - 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "bar" ? (
        <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} interval={interval} />
          <YAxis {...axis} tickFormatter={(v) => compact(v)} width={56} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
          <Bar dataKey="expense" name="expense" fill={COLORS.expense} radius={[6, 6, 0, 0]} animationDuration={900} />
          {showIncome && <Bar dataKey="income" name="income" fill={COLORS.income} radius={[6, 6, 0, 0]} animationDuration={900} />}
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.expense} stopOpacity={0.4} />
              <stop offset="100%" stopColor={COLORS.expense} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.income} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.income} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} interval={interval} />
          <YAxis {...axis} tickFormatter={(v) => compact(v)} width={56} />
          <Tooltip content={<ChartTip />} />
          {showIncome && <Area type="monotone" dataKey="income" name="income" stroke={COLORS.income} strokeWidth={2} fill="url(#gInc)" animationDuration={1000} />}
          <Area type="monotone" dataKey="expense" name="expense" stroke={COLORS.expense} strokeWidth={2.5} fill="url(#gExp)" animationDuration={1000} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export function CashflowChart({ data, height = 300 }: { data: { label: string; income: number; expense: number; net: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => compact(v)} width={56} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
        <ReferenceLine y={0} stroke={COLORS.tick} />
        <Bar dataKey="income" name="inflow" fill={COLORS.income} radius={[6, 6, 0, 0]} animationDuration={900} />
        <Bar dataKey="expense" name="outflow" fill={COLORS.expense} radius={[6, 6, 0, 0]} animationDuration={900} />
        <Line type="monotone" dataKey="net" name="net" stroke={COLORS.net} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={1100} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({ series, height = 280 }: { series: { label: string; actual?: number; forecast?: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={series} margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.expense} stopOpacity={0.35} />
            <stop offset="100%" stopColor={COLORS.expense} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => compact(v)} width={56} />
        <Tooltip content={<ChartTip />} />
        <Area type="monotone" dataKey="actual" name="actual" stroke={COLORS.expense} strokeWidth={2.5} fill="url(#gAct)" animationDuration={1000} />
        <Line type="monotone" dataKey="forecast" name="forecast" stroke={COLORS.forecast} strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 4, fill: COLORS.forecast }} animationDuration={1200} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function WeekdayChart({ data, height = 220 }: { data: { day: string; total: number }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="day" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => compact(v)} width={56} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
        <Bar dataKey="total" name="spent" radius={[8, 8, 0, 0]} animationDuration={900}>
          {data.map((d) => (
            <Cell key={d.day} fill={d.total === max ? "#f43f5e" : COLORS.expense} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data, height = 240, centerLabel = "Total" }: { data: { name: string; value: number }[]; height?: number; centerLabel?: string }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTip />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1000}>
            {data.map((d) => (
              <Cell key={d.name} fill={catMeta(d.name).color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xs text-slate-500">{centerLabel}</p>
          <p className="money text-xl font-bold tabular-nums">{compact(total)}</p>
        </div>
      </div>
    </div>
  );
}

export function BarList({ rows, format = (n: number) => money(n) }: { rows: { label: string; value: number; color?: string; sub?: string; emoji?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              {r.emoji && <span>{r.emoji}</span>}
              <span className="truncate">{r.label}</span>
              {r.sub && <span className="text-xs font-normal text-slate-400">{r.sub}</span>}
            </span>
            <span className="money shrink-0 font-semibold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
            <motion.div className="h-full rounded-full" style={{ background: r.color ?? "linear-gradient(90deg,var(--ac1),var(--ac2))" }} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Heatmap({ data }: { data: { date: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  const level = (a: number) => (a < 0 ? -1 : a === 0 ? 0 : Math.min(4, Math.ceil((a / max) * 4)));
  const bg = ["bg-slate-100 dark:bg-white/5", "bg-violet-200 dark:bg-violet-500/25", "bg-violet-300 dark:bg-violet-500/45", "bg-violet-500 dark:bg-violet-500/70", "bg-violet-700 dark:bg-violet-400"];
  return (
    <div>
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-1 pt-0 text-[10px] text-slate-400">
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
            <span key={i} className="flex h-full items-center">{d}</span>
          ))}
        </div>
        <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
          {data.map((d) => {
            const l = level(d.amount);
            return (
              <div key={d.date} title={d.amount < 0 ? "" : `${new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${money(d.amount)}`} className={cn("aspect-square min-h-3 rounded-[4px] transition hover:ring-2 hover:ring-violet-400", l < 0 ? "opacity-0" : bg[l])} />
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
        Less
        {bg.map((b, i) => (
          <span key={i} className={cn("h-3 w-3 rounded-[3px]", b)} />
        ))}
        More
      </div>
    </div>
  );
}

export function ScoreRing({ score, size = 168, label, invert }: { score: number; size?: number; label?: string; invert?: boolean }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const good = invert ? 100 - score : score;
  const color = good >= 80 ? "#10b981" : good >= 65 ? "#6366f1" : good >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={12} className="stroke-slate-200 dark:stroke-white/10" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.3, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</p>
          <p className="text-xs text-slate-500">{label ?? "/ 100"}</p>
        </div>
      </div>
    </div>
  );
}
