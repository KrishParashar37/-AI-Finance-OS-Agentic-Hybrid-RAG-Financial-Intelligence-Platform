/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { route, bad } from "@/lib/api";
import { RESOURCES, coerce } from "@/lib/resources";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ resource: string; id: string }> };

/** GET /api/resources/:resource/:id */
export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { resource, id } = await params;
  const table = RESOURCES[resource];
  if (!table) return bad("Unknown resource", 404);
  const [row] = await db.select().from(table as any).where(eq(table.id, Number(id)));
  if (!row) return bad("Not found", 404);
  return row;
});

/** PATCH /api/resources/:resource/:id  — partial update */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { resource, id } = await params;
  const table = RESOURCES[resource];
  if (!table) return bad("Unknown resource", 404);
  const body = await req.json();
  const data = coerce(table, body);
  if (!Object.keys(data).length) return bad("Nothing to update");
  await (db as any).update(table).set(data).where(eq(table.id, Number(id)));
  const [row] = await db.select().from(table as any).where(eq(table.id, Number(id)));
  if (!row) return bad("Not found", 404);
  await logActivity(
    `Updated ${resource.replace("-", " ")}`,
    String((row as any).name ?? (row as any).title ?? (row as any).category ?? id),
  );
  return row;
});

/** DELETE /api/resources/:resource/:id */
export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { resource, id } = await params;
  const table = RESOURCES[resource];
  if (!table) return bad("Unknown resource", 404);
  const [row] = await db.select().from(table as any).where(eq(table.id, Number(id)));
  if (!row) return bad("Not found", 404);
  await (db as any).delete(table).where(eq(table.id, Number(id)));
  await logActivity(
    `Deleted ${resource.replace("-", " ")}`,
    String((row as any).name ?? (row as any).title ?? (row as any).category ?? id),
  );
  return { ok: true };
});
