import type { NextRequest } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { buildReport } from "@/lib/report";
import { logActivity, notify } from "@/lib/log";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const b = await req.json();
  const from = new Date(b.from);
  const to = new Date(b.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return bad("Valid date range required");
  if (from > to) return bad("Start date must be before end date");
  const type = String(b.type ?? "monthly");
  const format = ["pdf", "excel", "csv"].includes(b.format) ? b.format : "pdf";
  const data = await buildReport(type, from, to);
  const [row] = await db.insert(reports).values({ type, format, rangeStart: from, rangeEnd: to, rowCount: data.rows.length }).$returningId();
  const created = { ...row, type, format, rangeStart: from, rangeEnd: to, status: "ready", rowCount: data.rows.length, createdAt: new Date() };
  await logActivity("Report generated", `${data.title} (${format.toUpperCase()})`);
  await notify("Report ready", `${data.title} is ready to download.`, "success");
  return created;
});
