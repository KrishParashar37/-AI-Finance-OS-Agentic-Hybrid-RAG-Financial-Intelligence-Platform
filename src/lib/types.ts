import type * as s from "@/db/schema";

type Ser<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

export type Txn = Ser<typeof s.transactions.$inferSelect>;
export type Account = Ser<typeof s.accounts.$inferSelect>;
export type Budget = Ser<typeof s.budgets.$inferSelect>;
export type Subscription = Ser<typeof s.subscriptions.$inferSelect>;
export type Bill = Ser<typeof s.bills.$inferSelect>;
export type Invoice = Ser<typeof s.invoices.$inferSelect>;
export type Goal = Ser<typeof s.goals.$inferSelect>;
export type Group = Ser<typeof s.groups.$inferSelect>;
export type SharedExpense = Ser<typeof s.sharedExpenses.$inferSelect>;
export type Settlement = Ser<typeof s.settlements.$inferSelect>;
export type Scan = Ser<typeof s.scans.$inferSelect>;
export type Report = Ser<typeof s.reports.$inferSelect>;
export type Notif = Ser<typeof s.notifications.$inferSelect>;
export type Activity = Ser<typeof s.activityLog.$inferSelect>;

export type TxnList = { items: Txn[]; total: number; page: number; limit: number; sum: number };

export type Stats = {
  range: { start: string; end: string; days: number };
  balance: number;
  totals: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
    count: number;
    avg: number;
    largest: { merchant: string; amount: number; date: string } | null;
    prevIncome: number;
    prevExpense: number;
    incomeDelta: number | null;
    expenseDelta: number | null;
    netDelta: number | null;
  };
  trend: { label: string; date: string; expense: number; income: number }[];
  categories: { name: string; value: number; pct: number; count: number; prev: number }[];
  merchants: { name: string; total: number; count: number; avg: number; category: string }[];
  weekday: { day: string; total: number; avg: number }[];
  heatmap: { date: string; amount: number }[];
  monthly: { key: string; label: string; income: number; expense: number; net: number }[];
  yearly: { year: string; income: number; expense: number; net: number }[];
  velocity: {
    spentMtd: number;
    perDay: number;
    projected: number;
    daysLeft: number;
    lastMonth: number;
    vsLastMonth: number | null;
  };
  forecast: { label: string; actual?: number; forecast?: number }[];
};

export type Insight = {
  id: string;
  type: "warning" | "info" | "success" | "tip" | "alert";
  title: string;
  body: string;
  href?: string;
};

export type InsightsPayload = {
  health: {
    score: number;
    label: string;
    components: { key: string; label: string; score: number; weight: number; detail: string }[];
  };
  insights: Insight[];
  predictions: {
    nextMonthTotal: number;
    monthEndProjection: number;
    projectedSavings: number;
    avgIncome: number;
    avgExpense: number;
    byCategory: { name: string; predicted: number; average: number; change: number }[];
    series: { label: string; actual?: number; forecast?: number }[];
  };
  advice: { id: string; title: string; body: string; impact: string; icon: string }[];
};

export type SecurityPayload = {
  riskScore: number;
  normal: number;
  suspicious: number;
  duplicates: number;
  flagged: Txn[];
};
