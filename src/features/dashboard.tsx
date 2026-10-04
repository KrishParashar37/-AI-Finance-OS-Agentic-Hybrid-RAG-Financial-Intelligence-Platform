"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CalendarClock, Landmark, PiggyBank, Plus, ScanLine, ShieldCheck, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Async, Badge, Card, ProgressBar, SectionTitle, Segmented, StatCard, PageHeader, Skeleton, ListSkeleton, EmptyState } from "@/components/ui";
import { AiBadge, InsightCard, TxnRow } from "@/components/cards";
import { CategoryDonut, ForecastChart, ScoreRing, SpendingChart, BarList } from "@/components/charts";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/components/providers";
import { catMeta, RANGES } from "@/lib/constants";
import { daysUntil, fmtDate, greeting, money } from "@/lib/format";
import type { Account, Bill, Budget, Goal, InsightsPayload, SecurityPayload, Stats, Subscription, TxnList } from "@/lib/types";
import { subMonthly } from "@/lib/client-utils";

const RANGE_OPTS = RANGES.filter((r) => r.value !== "custom") as { value: string; label: string }[];

export function Dashboard() {
  const { settings } = useSettings();
  const name = (settings.profile?.name as string) ?? "Krish";
  const [g, setG] = useState("Hello");
  useEffect(() => setG(greeting()), []);
  const [range, setRange] = useState("30d");
  const stats = useApi<Stats>(`/api/stats?range=${range}`);
  const ins = useApi<InsightsPayload>("/api/ai/insights");
  const recent = useApi<TxnList>("/api/transactions?limit=6");
  const bills = useApi<Bill[]>("/api/resources/bills");
  const budgets = useApi<Budget[]>("/api/resources/budgets");

  const upcoming = (bills.data ?? []).filter((b) => b.status !== "paid").sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate)).slice(0, 4);
  const overall = budgets.data?.find((b) => b.category === "Overall");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${g}, ${name} 👋`}
        subtitle="Here's your financial overview"
        actions={<Segmented size="sm" value={range} onChange={setRange} options={RANGE_OPTS} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Async q={stats} skeleton={<>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</>}>
          {(s) => (
            <>
              <StatCard label="Total Balance" value={s.balance} icon={Wallet} sub="across all accounts" />
              <StatCard label="Income" value={s.totals.income} delta={s.totals.incomeDelta} icon={TrendingUp} accent="linear-gradient(135deg,#10b981,#06b6d4)" sub="vs previous" />
              <StatCard label="Expenses" value={s.totals.expense} delta={s.totals.expenseDelta} goodWhenDown icon={TrendingDown} accent="linear-gradient(135deg,#f43f5e,#f97316)" sub="vs previous" />
              <StatCard label="Savings Rate" value={s.totals.savingsRate} format={(n) => `${n.toFixed(0)}%`} icon={PiggyBank} accent="linear-gradient(135deg,#0ea5e9,#6366f1)" sub={`${money(s.totals.net)} saved`} />
            </>
          )}
        </Async>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { href: "/scanner", label: "Scan receipt", icon: ScanLine },
          { href: "/expenses/new", label: "Add expense", icon: Plus },
          { href: "/income/new", label: "Add income", icon: Wallet },
          { href: "/ai", label: "Ask AI", icon: Bot },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="card card-hover flex items-center gap-3 !p-3.5">
            <span className="bg-grad grid h-10 w-10 place-items-center rounded-xl text-white"><a.icon className="h-5 w-5" /></span>
            <span className="text-sm font-medium">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Spending Overview" sub="Income vs expenses" action={<Link href="/analytics" className="text-xs font-medium text-indigo-500">Full analytics →</Link>} />
          <Async q={stats} skeleton={<Skeleton className="h-72" />}>{(s) => <SpendingChart data={s.trend} />}</Async>
        </Card>
        <Card>
          <SectionTitle title="AI Health Score" action={<AiBadge />} />
          <Async q={ins} skeleton={<Skeleton className="h-64" />}>
            {(d) => (
              <div className="text-center">
                <ScoreRing score={d.health.score} />
                <p className="mt-3 font-semibold">{d.health.label}</p>
                <p className="mt-1 text-xs text-slate-500">Based on savings, budgets, stability, bills & emergency fund</p>
                <Link href="/financial-health" className="btn btn-secondary btn-sm mt-4">View breakdown <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
          </Async>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Recent Transactions" action={<Link href="/expenses" className="text-xs font-medium text-indigo-500">View all →</Link>} />
          <Async q={recent} skeleton={<ListSkeleton rows={5} h="h-14" />}>
            {(d) => d.items.length ? <div className="-mx-2">{d.items.map((t) => <TxnRow key={t.id} t={t} />)}</div> : <EmptyState title="No transactions yet" body="Scan a receipt or add an expense." />}
          </Async>
        </Card>
        <div className="space-y-6">
          <Card className="relative overflow-hidden">
            <div className="bg-grad absolute inset-x-0 top-0 h-1" />
            <SectionTitle title="AI Insight" action={<AiBadge />} />
            <Async q={ins} skeleton={<Skeleton className="h-28" />}>
              {(d) => d.insights[0] ? <><InsightCard insight={d.insights[0]} /><Link href="/ai/insights" className="mt-3 block text-xs font-medium text-indigo-500">{d.insights.length - 1} more insights →</Link></> : <p className="text-sm text-slate-500">No insights yet.</p>}
            </Async>
          </Card>
          <Card>
            <SectionTitle title="Monthly Budget" action={<Link href="/budgets" className="text-xs font-medium text-indigo-500">Manage →</Link>} />
            <Async q={stats} skeleton={<Skeleton className="h-20" />}>
              {(s) => overall ? (
                <div>
                  <p className="money text-xl font-bold">{money(s.velocity.spentMtd)} <span className="text-sm font-normal text-slate-500">/ {money(overall.limitAmount)}</span></p>
                  <ProgressBar className="mt-3" value={s.velocity.spentMtd} max={overall.limitAmount} />
                  <p className="mt-2 text-xs text-slate-500">{Math.round((s.velocity.spentMtd / overall.limitAmount) * 100)}% used · {s.velocity.daysLeft} days left</p>
                </div>
              ) : <p className="text-sm text-slate-500">No budget set.</p>}
            </Async>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Spending by Category" />
          <Async q={stats} skeleton={<Skeleton className="h-60" />}>
            {(s) => s.categories.length ? (
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <CategoryDonut data={s.categories} />
                <ul className="space-y-2.5">
                  {s.categories.slice(0, 5).map((c) => (
                    <li key={c.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: catMeta(c.name).color }} />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-slate-500">{c.pct.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <EmptyState title="No spending in this period" />}
          </Async>
        </Card>
        <Card>
          <SectionTitle title="Upcoming Bills" action={<Link href="/bills" className="text-xs font-medium text-indigo-500">All bills →</Link>} />
          <Async q={bills} skeleton={<ListSkeleton rows={4} h="h-12" />}>
            {() => upcoming.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {upcoming.map((b) => {
                  const d = daysUntil(b.dueDate);
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><CalendarClock className="h-5 w-5" /></span>
                      <div className="flex-1">
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-slate-500">{fmtDate(b.dueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="money font-semibold">{money(b.amount)}</p>
                        <Badge tone={d < 0 ? "red" : d <= 5 ? "amber" : "slate"}>{d < 0 ? `${-d}d overdue` : d === 0 ? "Today" : `in ${d}d`}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="No upcoming bills" body="You're all paid up 🎉" />}
          </Async>
        </Card>
      </div>
    </div>
  );
}

export function Overview() {
  const stats = useApi<Stats>("/api/stats?range=30d");
  const ins = useApi<InsightsPayload>("/api/ai/insights");
  const accounts = useApi<Account[]>("/api/resources/accounts");
  const goals = useApi<Goal[]>("/api/resources/goals");
  const subs = useApi<Subscription[]>("/api/resources/subscriptions");
  const sec = useApi<SecurityPayload>("/api/security");
  const budgets = useApi<Budget[]>("/api/resources/budgets");

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Overview" subtitle="Your complete finances at a glance" icon={Landmark} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card hover>
          <p className="text-sm text-slate-500">Net worth</p>
          <Async q={accounts} skeleton={<Skeleton className="h-10" />}>{(a) => <p className="money mt-1 text-2xl font-bold">{money(a.reduce((x, y) => x + y.balance, 0))}</p>}</Async>
          <Link href="/accounts" className="mt-2 inline-block text-xs font-medium text-indigo-500">{accounts.data?.length ?? 0} accounts →</Link>
        </Card>
        <Card hover>
          <p className="text-sm text-slate-500">Subscriptions / month</p>
          <Async q={subs} skeleton={<Skeleton className="h-10" />}>{(s) => <p className="money mt-1 text-2xl font-bold">{money(s.filter((x) => x.status === "active").reduce((a, b) => a + subMonthly(b), 0))}</p>}</Async>
          <Link href="/subscriptions" className="mt-2 inline-block text-xs font-medium text-indigo-500">Manage →</Link>
        </Card>
        <Card hover>
          <p className="text-sm text-slate-500">Security risk score</p>
          <Async q={sec} skeleton={<Skeleton className="h-10" />}>{(s) => <p className="mt-1 text-2xl font-bold">{s.riskScore}<span className="text-sm font-normal text-slate-500"> / 100</span></p>}</Async>
          <Link href="/ai/anomalies" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-500"><ShieldCheck className="h-3 w-3" /> Security Center →</Link>
        </Card>
        <Card hover>
          <p className="text-sm text-slate-500">Projected savings (next month)</p>
          <Async q={ins} skeleton={<Skeleton className="h-10" />}>{(d) => <p className="money mt-1 text-2xl font-bold">{money(d.predictions.projectedSavings)}</p>}</Async>
          <Link href="/ai/predictions" className="mt-2 inline-block text-xs font-medium text-indigo-500">Predictions →</Link>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Goals" action={<Link href="/goals" className="text-xs font-medium text-indigo-500">All goals →</Link>} />
          <Async q={goals} skeleton={<ListSkeleton rows={3} h="h-12" />}>
            {(g) => <ul className="space-y-4">{g.map((x) => <li key={x.id}><div className="mb-1.5 flex justify-between text-sm"><span>{x.emoji} {x.name}</span><span className="text-slate-500">{Math.round((x.saved / x.target) * 100)}%</span></div><ProgressBar value={x.saved} max={x.target} warn={false} /></li>)}</ul>}
          </Async>
        </Card>
        <Card>
          <SectionTitle title="Budget status (this month)" action={<Link href="/budgets" className="text-xs font-medium text-indigo-500">Budgets →</Link>} />
          <Async q={stats} skeleton={<ListSkeleton rows={4} h="h-10" />}>
            {(s) => (
              <BarList
                rows={(budgets.data ?? []).filter((b) => b.category !== "Overall").slice(0, 6).map((b) => {
                  const spent = s.categories.find((c) => c.name === b.category)?.value ?? 0;
                  return { label: b.category, emoji: catMeta(b.category).emoji, value: spent, sub: `of ${money(b.limitAmount)}`, color: spent > b.limitAmount ? "#ef4444" : catMeta(b.category).color };
                })}
              />
            )}
          </Async>
        </Card>
      </div>
      <Card>
        <SectionTitle title="Spending forecast" sub="Actual vs predicted monthly expenses" action={<AiBadge />} />
        <Async q={ins} skeleton={<Skeleton className="h-64" />}>{(d) => <ForecastChart series={d.predictions.series} />}</Async>
      </Card>
    </div>
  );
}

export function FinancialHealth() {
  const ins = useApi<InsightsPayload>("/api/ai/insights");
  return (
    <div className="space-y-6">
      <PageHeader title="Financial Health" subtitle="AI-computed score across six dimensions" icon={ShieldCheck} actions={<AiBadge>AI Scored</AiBadge>} />
      <Async q={ins}>
        {(d) => (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="text-center">
              <ScoreRing score={d.health.score} size={200} />
              <p className="mt-4 text-xl font-bold">{d.health.label}</p>
              <p className="mt-1 text-sm text-slate-500">Your score is a weighted average of the six factors on the right.</p>
            </Card>
            <Card className="lg:col-span-2">
              <SectionTitle title="Score breakdown" />
              <ul className="space-y-5">
                {d.health.components.map((c) => (
                  <li key={c.key}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{c.label} <span className="text-xs font-normal text-slate-400">({Math.round(c.weight * 100)}% weight)</span></span>
                      <span className="font-semibold tabular-nums">{c.score}/100</span>
                    </div>
                    <ProgressBar value={c.score} color={c.score >= 70 ? "#10b981" : c.score >= 50 ? "#f59e0b" : "#ef4444"} warn={false} />
                    <p className="mt-1 text-xs text-slate-500">{c.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-3 lg:col-span-3">
              <SectionTitle title="How to improve" />
              <div className="grid gap-3 md:grid-cols-2">{d.advice.slice(0, 4).map((a) => <Card key={a.id} hover className="flex gap-3"><span className="text-2xl">{a.icon}</span><div><p className="font-semibold">{a.title}</p><p className="mt-0.5 text-sm text-slate-500">{a.body}</p></div></Card>)}</div>
            </div>
          </div>
        )}
      </Async>
    </div>
  );
}
