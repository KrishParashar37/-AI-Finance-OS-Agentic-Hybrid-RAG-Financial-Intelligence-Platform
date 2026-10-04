import type { NextRequest } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
});

/** PUT { key, value } — upserts one settings group. */
export const PUT = route(async (req: NextRequest) => {
  const { key, value } = (await req.json()) as { key?: string; value?: unknown };
  if (!key || value === undefined) return bad("key and value required");
  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  await logActivity("Settings updated", key);
  return { ok: true };
});
