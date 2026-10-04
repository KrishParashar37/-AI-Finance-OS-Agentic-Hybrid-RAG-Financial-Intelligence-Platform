"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowDownLeft, Plus, TrendingUp, Wallet } from "lucide-react";
import { Async, Card, PageHeader, SectionTitle, Skeleton, StatCard } from "@/components/ui";
import { BarList, SpendingChart } from "@/components/charts";
import { TransactionExplorer } from "@/components/tables/TransactionExplorer";
import { useApi } from "@/hooks/useApi";
import { catMeta } from "@/lib/constants";
import { money } from "@/lib/format";
import type { Stats, TxnList } from "@/lib/types";

export function IncomePage() {
  const stats = useApi<Stats>("/api/stats?range=6m");
  const list = useApi<TxnList>("/api/transactions?type=income&limit=200");
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of list.data?.items ?? []) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
    return [...m.entries()].map(([label, value]) => ({ label, value, emoji: catMeta(label).emoji, color: catMeta(label).color })).sort((a, b) => b.value - a.value);
  }, [list.data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Income" subtitle="Salary, freelance and every other inflow" icon={Wallet} actions={<Link href="/income/new" className="btn btn-primary"><Plus className="h-4 w-4" /> Add income</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Async q={stats} skeleton={<>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</>}>
          {(s) => (
            <>
              <StatCard label="Income (6 months)" value={s.totals.income} delta={s.totals.incomeDelta} icon={TrendingUp} accent="linear-gradient(135deg,#10b981,#06b6d4)" sub="vs previous" />
              <StatCard label="Avg. monthly income" value={s.totals.income / 6} icon={ArrowDownLeft} />
              <StatCard label="Net savings (6 months)" value={s.totals.net} icon={Wallet} accent="linear-gradient(135deg,#0ea5e9,#6366f1)" />
            </>
          )}
        </Async>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Monthly income vs expenses" />
          <Async q={stats} skeleton={<Skeleton className="h-64" />}>{(s) => <SpendingChart type="bar" data={s.monthly.slice(-6).map((m) => ({ label: m.label, income: m.income, expense: m.expense }))} height={260} />}</Async>
        </Card>
        <Card>
          <SectionTitle title="Income sources" />
          <Async q={list} skeleton={<Skeleton className="h-48" />}>{() => <BarList rows={bySource} />}</Async>
        </Card>
      </div>
      <TransactionExplorer type="income" />
    </div>
  );
}
