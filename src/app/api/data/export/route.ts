/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/db";
import * as s from "@/db/schema";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const t = async (table: any) => db.select().from(table);
  const settingsRows = await db.select().from(s.settings);
  const payload = {
    app: "AI Expense Scanner",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      transactions: await t(s.transactions),
      accounts: await t(s.accounts),
      budgets: await t(s.budgets),
      subscriptions: await t(s.subscriptions),
      bills: await t(s.bills),
      invoices: await t(s.invoices),
      goals: await t(s.goals),
      groups: await t(s.groups),
      shared_expenses: await t(s.sharedExpenses),
      settlements: await t(s.settlements),
      scans: (await t(s.scans)).map((x: any) => ({ ...x, previewUrl: "" })),
      reports: await t(s.reports),
      notifications: await t(s.notifications),
      activity_log: await t(s.activityLog),
    },
    settings: Object.fromEntries(settingsRows.map((r) => [r.key, r.value])),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="ai-expense-scanner-backup.json"` },
  });
}
