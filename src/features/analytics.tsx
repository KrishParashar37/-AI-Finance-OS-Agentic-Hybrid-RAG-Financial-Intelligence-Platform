"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, Gauge, LineChart, PieChart, Store, TrendingUp, Trophy, Wallet, Receipt } from "lucide-react";
import { Async, Card, DeltaChip, PageHeader, SectionTitle, Segmented, Skeleton, StatCard, CatIcon, PageSkeleton } from "@/components/ui";
import { BarList, CashflowChart, CategoryDonut, ForecastChart, Heatmap, SpendingChart, WeekdayChart } from "@/components/charts";
import { DateRangePicker } from "@/components/forms";
import { useApi } from "@/hooks/useApi";
import { RANGES, catMeta } from "@/lib/constants";
import { compact, fmtDate, money, pctText, toInputDate } from "@/lib/format";
import type { Stats } from "@/lib/types";

function useRange(initial = "30d") {
  const [range, setRange] = useState(initial);
  const [from, setFrom] = useState(toInputDate(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(toInputDate());
  const custom = range === "custom" && from && to;
  const url = `/api/stats?range=${custom ? "custom" : range === "custom" ? "30d" : range}${custom ? `&from=${from}&to=${to}` : ""}`;
  const control = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented size="sm" value={range} onChange={setRange} options={RANGES} />
      {range === "custom" && <div className="w-64"><DateRangePicker from={from} to={to} align="right" onChange={(f, t) => { setFrom(f); setTo(t); }} /></div>}
    </div>
  );
  return { url, control, range };
}

const SUB_LINKS = [
  { href: "/analytics/spending", label: "Spending", icon: LineChart },
  { href: "/analytics/categories", label: "Categories", icon: PieChart },
  { href: "/analytics/merchants", label: "Merchants", icon: Store },
  { href: "/analytics/cash-flow", label: "Cash flow", icon: Activity },
];

export function Analytics() {
  const { url, control } = useRange();
  const q = useApi<Stats>(url);
  const [type, setType] = useState<"area" | "bar">("area");
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Interactive insights into your money" icon={BarChart3} actions={control} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SUB_LINKS.map((l) => <Link key={l.href} href={l.href} className="card card-hover flex items-center gap-2.5 !p-3 text-sm font-medium"><l.icon className="h-4 w-4 text-indigo-500" />{l.label}</Link>)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Async q={q} skeleton={<>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</>}>
          {(s) => (
            <>
              <StatCard label="Total spent" value={s.totals.expense} delta={s.totals.expenseDelta} goodWhenDown icon={Wallet} accent="linear-gradient(135deg,#f43f5e,#f97316)" />
              <StatCard label="Total income" value={s.totals.income} delta={s.totals.incomeDelta} icon={TrendingUp} accent="linear-gradient(135deg,#10b981,#06b6d4)" />
              <StatCard label="Average transaction" value={s.totals.avg} icon={Receipt} sub={`${s.totals.count} transactions`} />
              <StatCard label="Largest transaction" value={s.totals.largest?.amount ?? 0} icon={Trophy} sub={s.totals.largest ? `${s.totals.largest.merchant} · ${fmtDate(s.totals.largest.date)}` : ""} accent="linear-gradient(135deg,#f59e0b,#ef4444)" />
            </>
          )}
        </Async>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Spending trend" action={<Segmented size="sm" value={type} onChange={setType} options={[{ value: "area", label: "Area" }, { value: "bar", label: "Bars" }]} />} />
          <Async q={q} skeleton={<Skeleton className="h-72" />}>{(s) => <SpendingChart data={s.trend} type={type} />}</Async>
        </Card>
        <Card>
          <SectionTitle title="Category distribution" />
          <Async q={q} skeleton={<Skeleton className="h-60" />}>{(s) => <CategoryDonut data={s.categories} centerLabel="Spent" />}</Async>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Income vs expense (monthly)" />
          <Async q={q} skeleton={<Skeleton className="h-64" />}>{(s) => <SpendingChart type="bar" data={s.monthly.slice(-6).map((m) => ({ label: m.label, income: m.income, expense: m.expense }))} height={260} />}</Async>
        </Card>
        <Card>
          <SectionTitle title="Top merchants" action={<Link href="/analytics/merchants" className="text-xs font-medium text-indigo-500">All →</Link>} />
          <Async q={q} skeleton={<Skeleton className="h-64" />}>{(s) => <BarList rows={s.merchants.slice(0, 6).map((m) => ({ label: m.name, value: m.total, sub: `${m.count}×`, emoji: catMeta(m.category).emoji }))} />}</Async>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Spending by weekday" />
          <Async q={q} skeleton={<Skeleton className="h-56" />}>{(s) => <WeekdayChart data={s.weekday} />}</Async>
        </Card>
        <Card>
          <SectionTitle title="Spending heatmap" sub="Last 12 weeks" />
          <Async q={q} skeleton={<Skeleton className="h-56" />}>{(s) => <Heatmap data={s.heatmap} />}</Async>
        </Card>
      </div>
      <Card>
        <SectionTitle title="Forecast" sub="Next 3 months based on your trend" action={<Link href="/ai/predictions" className="text-xs font-medium text-indigo-500">Predictions →</Link>} />
        <Async q={q} skeleton={<Skeleton className="h-64" />}>{(s) => <ForecastChart series={s.forecast} />}</Async>
      </Card>
    </div>
  );
}

export function SpendingAnalytics() {
  const [view, setView] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const byView = useApi<Stats>(`/api/stats?range=${view === "daily" ? "30d" : view === "weekly" ? "3m" : "1y"}`);
  const { url, control } = useRange("3m");
  const q = useApi<Stats>(url);
  const data = useMemo(() => {
    const s = byView.data;
    if (!s) return [];
    if (view === "monthly") return s.monthly.map((m) => ({ label: m.label, expense: m.expense, income: m.income }));
    if (view === "yearly") return s.yearly.map((y) => ({ label: y.year, expense: y.expense, income: y.income }));
    return s.trend;
  }, [byView.data, view]);
  return (
    <div className="space-y-6">
      <PageHeader title="Spending Analytics" subtitle="Daily, weekly, monthly and yearly views" icon={LineChart} actions={control} />
      <Card>
        <SectionTitle title="Spending by period" action={<Segmented size="sm" value={view} onChange={setView} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />} />
        <Async q={byView} skeleton={<Skeleton className="h-72" />}>{() => <SpendingChart data={data} type={view === "daily" || view === "weekly" ? "area" : "bar"} showIncome={view === "monthly" || view === "yearly"} />}</Async>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Async q={q} skeleton={<>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</>}>
          {(s) => (
            <>
              <Card><p className="text-sm text-slate-500">Spending velocity</p><p className="money mt-1 text-2xl font-bold">{money(s.velocity.perDay)}<span className="text-sm font-normal text-slate-500">/day</span></p><p className="mt-1 text-xs text-slate-500">this month</p></Card>
              <Card><p className="text-sm text-slate-500">Projected month-end</p><p className="money mt-1 text-2xl font-bold">{money(s.velocity.projected)}</p><div className="mt-1"><DeltaChip value={s.velocity.vsLastMonth} goodWhenDown /> <span className="text-xs text-slate-500">vs last month</span></div></Card>
              <Card><p className="text-sm text-slate-500">Spent so far (MTD)</p><p className="money mt-1 text-2xl font-bold">{money(s.velocity.spentMtd)}</p><p className="mt-1 text-xs text-slate-500">{s.velocity.daysLeft} days left</p></Card>
              <Card><p className="text-sm text-slate-500">Last month total</p><p className="money mt-1 text-2xl font-bold">{money(s.velocity.lastMonth)}</p></Card>
            </>
          )}
        </Async>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><SectionTitle title="Weekday pattern" /><Async q={q} skeleton={<Skeleton className="h-56" />}>{(s) => <WeekdayChart data={s.weekday} />}</Async></Card>
        <Card><SectionTitle title="Heatmap" sub="Daily intensity, last 12 weeks" /><Async q={q} skeleton={<Skeleton className="h-56" />}>{(s) => <Heatmap data={s.heatmap} />}</Async></Card>
      </div>
    </div>
  );
}

export function CategoryAnalytics() {
  const { url, control } = useRange("3m");
  const q = useApi<Stats>(url);
  return (
    <div className="space-y-6">
      <PageHeader title="Category Analytics" subtitle="Share, trend and change by category" icon={PieChart} actions={control} />
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={4} />}>
        {(s) => (
          <>
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-2"><SectionTitle title="Distribution" /><CategoryDonut data={s.categories} height={280} centerLabel="Spent" /></Card>
              <Card className="lg:col-span-3"><SectionTitle title="Spend by category" /><BarList rows={s.categories.map((c) => ({ label: c.name, value: c.value, emoji: catMeta(c.name).emoji, color: catMeta(c.name).color, sub: `${c.pct.toFixed(0)}%` }))} /></Card>
            </div>
            <Card className="overflow-x-auto !p-0">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-slate-100 dark:border-white/10"><tr><th className="th">Category</th><th className="th text-right">Amount</th><th className="th text-right">Share</th><th className="th text-right">Txns</th><th className="th text-right">Avg</th><th className="th text-right">vs prev.</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {s.categories.map((c) => (
                    <tr key={c.name}>
                      <td className="td"><span className="flex items-center gap-3"><CatIcon name={c.name} size="sm" />{c.name}</span></td>
                      <td className="td money text-right font-semibold">{money(c.value)}</td>
                      <td className="td text-right">{c.pct.toFixed(1)}%</td>
                      <td className="td text-right">{c.count}</td>
                      <td className="td money text-right">{money(c.value / Math.max(1, c.count))}</td>
                      <td className="td text-right">{c.prev > 0 ? <DeltaChip value={((c.value - c.prev) / c.prev) * 100} goodWhenDown /> : <span className="text-xs text-slate-400">new</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </Async>
    </div>
  );
}

export function MerchantAnalytics() {
  const { url, control } = useRange("3m");
  const q = useApi<Stats>(url);
  const [search, setSearch] = useState("");
  return (
    <div className="space-y-6">
      <PageHeader title="Merchant Analytics" subtitle="Who you pay the most, and how often" icon={Store} actions={control} />
      <Async q={q} skeleton={<PageSkeleton cards={1} rows={4} />}>
        {(s) => {
          const total = s.totals.expense || 1;
          const rows = s.merchants.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
          return (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card><SectionTitle title="Top merchants by spend" /><BarList rows={s.merchants.slice(0, 8).map((m) => ({ label: m.name, value: m.total, emoji: catMeta(m.category).emoji, color: catMeta(m.category).color }))} /></Card>
                <Card><SectionTitle title="Most frequent" /><BarList format={(n) => `${n} visits`} rows={[...s.merchants].sort((a, b) => b.count - a.count).slice(0, 8).map((m) => ({ label: m.name, value: m.count, emoji: catMeta(m.category).emoji, color: catMeta(m.category).color }))} /></Card>
              </div>
              <div className="flex items-center justify-between gap-3"><SectionTitle title="All merchants" /><input className="input max-w-52" placeholder="Filter merchants…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter merchants" /></div>
              <Card className="overflow-x-auto !p-0">
                <table className="w-full min-w-[560px]">
                  <thead className="border-b border-slate-100 dark:border-white/10"><tr><th className="th">Merchant</th><th className="th">Category</th><th className="th text-right">Visits</th><th className="th text-right">Avg</th><th className="th text-right">Total</th><th className="th text-right">Share</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {rows.map((m) => (
                      <tr key={m.name}><td className="td font-medium">{m.name}</td><td className="td">{catMeta(m.category).emoji} {m.category}</td><td className="td text-right">{m.count}</td><td className="td money text-right">{money(m.avg)}</td><td className="td money text-right font-semibold">{money(m.total)}</td><td className="td text-right">{((m.total / total) * 100).toFixed(1)}%</td></tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-slate-500">No merchants match “{search}”</td></tr>}
                  </tbody>
                </table>
              </Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}

export function CashFlow() {
  const q = useApi<Stats>("/api/stats?range=1y");
  const [months, setMonths] = useState<"6" | "12">("6");
  return (
    <div className="space-y-6">
      <PageHeader title="Cash Flow" subtitle="Inflows, outflows and runway" icon={Activity} actions={<Segmented size="sm" value={months} onChange={setMonths} options={[{ value: "6", label: "6 months" }, { value: "12", label: "12 months" }]} />} />
      <Async q={q} skeleton={<PageSkeleton cards={4} rows={0} />}>
        {(s) => {
          const m = s.monthly.slice(-Number(months));
          const done = m.slice(0, -1);
          const inflow = m.reduce((a, b) => a + b.income, 0);
          const outflow = m.reduce((a, b) => a + b.expense, 0);
          const burn = done.length ? done.reduce((a, b) => a + b.expense, 0) / done.length : 0;
          let acc = 0;
          const cum = m.map((x) => ({ label: x.label, income: x.income, expense: x.expense, net: (acc += x.net) }));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="Total inflow" value={inflow} icon={TrendingUp} accent="linear-gradient(135deg,#10b981,#06b6d4)" />
                <StatCard label="Total outflow" value={outflow} icon={Wallet} accent="linear-gradient(135deg,#f43f5e,#f97316)" />
                <StatCard label="Net cash flow" value={inflow - outflow} icon={Activity} />
                <StatCard label="Runway" value={burn ? s.balance / burn : 0} format={(n) => `${n.toFixed(1)} mo`} icon={Gauge} sub={`at ${compact(burn)}/month burn`} accent="linear-gradient(135deg,#0ea5e9,#6366f1)" />
              </div>
              <Card><SectionTitle title="Monthly cash flow" sub="Bars: inflow & outflow · Line: cumulative net" /><CashflowChart data={cum} /></Card>
              <Card className="overflow-x-auto !p-0">
                <table className="w-full min-w-[480px]">
                  <thead className="border-b border-slate-100 dark:border-white/10"><tr><th className="th">Month</th><th className="th text-right">Inflow</th><th className="th text-right">Outflow</th><th className="th text-right">Net</th><th className="th text-right">Savings rate</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {[...m].reverse().map((x) => (
                      <tr key={x.key}><td className="td font-medium">{x.label}</td><td className="td money text-right text-emerald-600">{money(x.income)}</td><td className="td money text-right">{money(x.expense)}</td><td className={`td money text-right font-semibold ${x.net < 0 ? "text-rose-500" : ""}`}>{money(x.net, { sign: true })}</td><td className="td text-right">{x.income ? pctText((x.net / x.income) * 100).replace("+", "") : "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card><SectionTitle title="Expense forecast" /><ForecastChart series={s.forecast} /></Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}

