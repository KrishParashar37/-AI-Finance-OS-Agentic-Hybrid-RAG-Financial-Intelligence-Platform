"use client";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";
import { monthGrid } from "@/lib/client-utils";

export function useMonth(initial = new Date()) {
  return { year: initial.getFullYear(), month: initial.getMonth() };
}

export function MonthCalendar({ year, month, onChange, render }: { year: number; month: number; onChange: (y: number, m: number) => void; render: (day: number) => ReactNode }) {
  const cells = monthGrid(year, month);
  const now = new Date();
  const isToday = (d: number) => now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;
  const shift = (n: number) => {
    const d = new Date(year, month + n, 1);
    onChange(d.getFullYear(), d.getMonth());
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
        <div className="flex gap-1">
          <button className="btn btn-secondary btn-sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => onChange(now.getFullYear(), now.getMonth())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-slate-400 uppercase sm:gap-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="pb-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((d, i) => (
          <div key={i} className={cn("min-h-16 rounded-xl border p-1.5 text-left sm:min-h-24 sm:p-2", d ? "border-slate-200/70 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]" : "border-transparent", d && isToday(d) && "!border-[color:var(--ac1)] ring-2 ring-[color:var(--ac1)]/20")}>
            {d && (<><span className={cn("text-xs font-semibold", isToday(d) ? "text-indigo-500" : "text-slate-500")}>{d}</span><div className="mt-1 space-y-1">{render(d)}</div></>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chip({ children, color = "#6366f1" }: { children: ReactNode; color?: string }) {
  return <div className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white sm:text-[11px]" style={{ background: color }}>{children}</div>;
}
