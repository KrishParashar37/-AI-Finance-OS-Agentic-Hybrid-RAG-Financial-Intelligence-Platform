import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/reports/:id — returns report metadata + first 25 preview rows */
export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const [report] = await db.select().from(reports).where(eq(reports.id, Number(id)));
  if (!report) return bad("Report not found", 404);
  const data = await buildReport(report.type, report.rangeStart, report.rangeEnd);
  return {
    ...report,
    title: data.title,
    summary: data.summary,
    headers: data.headers,
    previewRows: data.rows.slice(0, 25),
    totalRows: data.rows.length,
  };
});

/** DELETE /api/reports/:id */
export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const [row] = await db.select().from(reports).where(eq(reports.id, Number(id)));
  if (!row) return bad("Report not found", 404);
  await db.delete(reports).where(eq(reports.id, Number(id)));
  return { ok: true };
});
