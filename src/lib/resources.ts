import { getTableColumns } from "drizzle-orm";
import * as s from "@/db/schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const RESOURCES: Record<string, any> = {
  budgets: s.budgets,
  subscriptions: s.subscriptions,
  bills: s.bills,
  invoices: s.invoices,
  goals: s.goals,
  accounts: s.accounts,
  groups: s.groups,
  "shared-expenses": s.sharedExpenses,
  settlements: s.settlements,
  reports: s.reports,
  notifications: s.notifications,
  scans: s.scans,
  activity: s.activityLog,
};

export function coerce(table: any, body: Record<string, unknown>) {
  const cols = getTableColumns(table) as Record<string, any>;
  const out: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(cols)) {
    if (k === "id" || k === "createdAt") continue;
    if (!(k in body)) continue;
    let v = body[k];
    if (c.dataType === "date" && typeof v === "string") v = new Date(v);
    out[k] = v;
  }
  return out;
}

/** Same as coerce but keeps id/createdAt (used for restore). */
export function coerceFull(table: any, row: Record<string, unknown>) {
  const cols = getTableColumns(table) as Record<string, any>;
  const out: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(cols)) {
    if (!(k in row)) continue;
    let v = row[k];
    if (c.dataType === "date" && typeof v === "string") v = new Date(v);
    out[k] = v;
  }
  return out;
}
