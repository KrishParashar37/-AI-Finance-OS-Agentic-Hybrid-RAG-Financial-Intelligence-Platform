import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { buildReport, toCsv, toXls, toPdf } from "@/lib/report";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/reports/:id/download
 * Streams the report as the correct file format (PDF / CSV / Excel).
 */
export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const [report] = await db.select().from(reports).where(eq(reports.id, Number(id)));
  if (!report) return bad("Report not found", 404);

  const data = await buildReport(report.type, report.rangeStart, report.rangeEnd);
  const slug = data.title.toLowerCase().replace(/\s+/g, "-");
  const filename = `${slug}-${report.id}`;

  switch (report.format) {
    case "csv": {
      const csv = toCsv(data);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }
    case "excel":
    case "xlsx": {
      const xls = toXls(data);
      return new Response(xls, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.xls"`,
        },
      });
    }
    default: {
      // PDF
      const pdf = toPdf(data);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }
  }
});
