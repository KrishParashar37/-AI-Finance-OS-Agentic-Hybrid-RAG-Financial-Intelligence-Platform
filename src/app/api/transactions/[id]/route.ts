import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { coerce } from "@/lib/resources";
import { applyBalance } from "@/lib/balance";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const [row] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  return row ?? bad("Transaction not found", 404);
});

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  const [old] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  if (!old) return bad("Transaction not found", 404);
  const data = coerce(transactions, body);
  if (Object.keys(data).length === 0) return bad("Nothing to update");
  await db.update(transactions).set(data).where(eq(transactions.id, Number(id)));
  const row = { ...old, ...data };
  if (old.amount !== row.amount || old.accountId !== row.accountId || old.type !== row.type) {
    await applyBalance(old.accountId, old.type, old.amount, -1);
    await applyBalance(row.accountId, row.type, row.amount, 1);
  }
  await logActivity("Transaction updated", row.merchant);
  return row;
});

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const [row] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  if (!row) return bad("Transaction not found", 404);
  await db.delete(transactions).where(eq(transactions.id, Number(id)));
  await applyBalance(row.accountId, row.type, row.amount, -1);
  await logActivity("Transaction deleted", row.merchant);
  return { ok: true };
});
