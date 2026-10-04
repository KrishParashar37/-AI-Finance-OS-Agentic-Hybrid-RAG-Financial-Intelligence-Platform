import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scans, transactions } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { assessRisk } from "@/lib/risk";
import { applyBalance } from "@/lib/balance";
import { logActivity, notify } from "@/lib/log";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/scan/:id/save
 * Converts a processed scan into a real expense transaction.
 * Body: { merchant?, date?, total?, tax?, category?, paymentMethod? }
 */
export const POST = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;

  const [scan] = await db.select().from(scans).where(eq(scans.id, Number(id)));
  if (!scan) return bad("Scan not found", 404);
  if (scan.status === "saved") return bad("This scan has already been saved as an expense");

  // Merge scan data with any overrides from the request body
  const body = await req.json().catch(() => ({}));
  const merchant = String(body.merchant ?? scan.merchant).trim();
  const total = Number(body.total ?? scan.total);
  const tax = Number(body.tax ?? scan.tax ?? 0);
  const category = String(body.category ?? scan.category);
  const paymentMethod = String(body.paymentMethod ?? scan.paymentMethod ?? "UPI");
  const date = body.date ? new Date(body.date) : scan.date;

  if (!merchant) return bad("Merchant is required");
  if (!(total > 0)) return bad("Total must be greater than 0");

  // Assess risk on the transaction
  const history = await db.select().from(transactions);
  const { risk, reason } = assessRisk({ merchant, category, amount: total, date, type: "expense" }, history);

  const values = {
    type: "expense" as const,
    merchant,
    category,
    amount: total,
    tax,
    date,
    paymentMethod,
    accountId: null,
    notes: `Scanned from ${scan.fileName}`,
    source: "scan" as const,
    recurring: false,
    risk,
    riskReason: reason,
  };

  const [row] = await db.insert(transactions).values(values).$returningId();
  const created = { ...row, ...values, createdAt: new Date() };

  // Update scan status to saved
  await db.update(scans).set({ status: "saved" }).where(eq(scans.id, scan.id));

  // Update account balance if applicable
  await applyBalance(created.accountId, created.type, created.amount, 1);

  await logActivity("Receipt saved as expense", `${merchant} ${money(total)} (from ${scan.fileName})`);
  if (risk !== "low") {
    await notify(
      `${risk === "high" ? "High-risk" : "Suspicious"} transaction flagged`,
      `${merchant} ${money(total)}: ${reason}`,
      "alert",
    );
  }

  return { transaction: created, scan: { ...scan, status: "saved" } };
});
