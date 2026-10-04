/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { route, bad } from "@/lib/api";
import { RESOURCES, coerce } from "@/lib/resources";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ resource: string }> };

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { resource } = await params;
  const table = RESOURCES[resource];
  if (!table) return bad("Unknown resource", 404);
  const rows: any[] = await db.select().from(table as any).orderBy(desc(table.id));
  // keep list payloads light: previews are only returned by the detail endpoint
  return resource === "scans" ? rows.map((r) => ({ ...r, previewUrl: r.previewUrl ? "yes" : "" })) : rows;
});

export const POST = route(async (req: NextRequest, { params }: Ctx) => {
  const { resource } = await params;
  const table = RESOURCES[resource];
  if (!table) return bad("Unknown resource", 404);
  const body = await req.json();
  const data = coerce(table, body);
  const [inserted] = await (db as any).insert(table).values(data).$returningId();
  const [row] = await db.select().from(table as any).where(eq(table.id, (inserted as any).id));
  if (resource !== "activity" && resource !== "notifications") await logActivity(`Created ${resource.replace("-", " ")}`, String((row as any).name ?? (row as any).title ?? (row as any).category ?? (row as any).number ?? ""));
  return row;
});

/** Bulk update: { set: {...} } updates every row (e.g. mark all notifications read). */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { resource } = await params;
  const table = RESOURCES[resource];
  if (!table) return bad("Unknown resource", 404);
  const { set } = await req.json();
  const data = coerce(table, set ?? {});
  if (!Object.keys(data).length) return bad("Nothing to update");
  await db.update(table as any).set(data as any);
  return { ok: true };
});

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { resource } = await params;
  if (resource !== "notifications" && resource !== "activity") return bad("Bulk delete not allowed", 403);
  await db.delete(RESOURCES[resource] as any);
  return { ok: true };
});
