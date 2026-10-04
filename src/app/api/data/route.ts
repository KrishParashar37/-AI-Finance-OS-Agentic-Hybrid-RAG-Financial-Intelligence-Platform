/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { db } from "@/db";
import * as s from "@/db/schema";
import { route, bad } from "@/lib/api";
import { clearAll, seedAll } from "@/db/seed";
import { coerceFull } from "@/lib/resources";

export const dynamic = "force-dynamic";

const TABLES: Record<string, any> = {
  transactions: s.transactions,
  accounts: s.accounts,
  budgets: s.budgets,
  subscriptions: s.subscriptions,
  bills: s.bills,
  invoices: s.invoices,
  goals: s.goals,
  groups: s.groups,
  shared_expenses: s.sharedExpenses,
  settlements: s.settlements,
  scans: s.scans,
  reports: s.reports,
  notifications: s.notifications,
  activity_log: s.activityLog,
};

/** POST { action: "reset" | "demo" | "restore", data? } */
export const POST = route(async (req: NextRequest) => {
  const { action, data } = (await req.json()) as { action: string; data?: Record<string, any[]> };
  if (action === "reset") {
    await clearAll();
    return { ok: true };
  }
  if (action === "demo") {
    await seedAll();
    return { ok: true };
  }
  if (action === "restore") {
    if (!data || typeof data !== "object" || !data.tables) return bad("Invalid backup file");
    const tables = (data as any).tables as Record<string, any[]>;
    await clearAll();
    for (const [name, table] of Object.entries(TABLES)) {
      const rows = tables[name];
      if (!Array.isArray(rows) || !rows.length) continue;
      const values = rows.map((r) => coerceFull(table, r));
      for (let i = 0; i < values.length; i += 200) await db.insert(table).values(values.slice(i, i + 200));
    }
    const st = (data as any).settings as Record<string, unknown> | undefined;
    if (st) for (const [key, value] of Object.entries(st)) await db.insert(s.settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    return { ok: true };
  }
  return bad("Unknown action");
});
