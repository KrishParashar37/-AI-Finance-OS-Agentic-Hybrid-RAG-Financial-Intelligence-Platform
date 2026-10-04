import { db } from "@/db";
import { and, gte, lte, asc } from "drizzle-orm";
import { transactions, budgets } from "@/db/schema";
import { sum, MONTHS } from "@/lib/analytics";
import { money, fmtDate } from "@/lib/format";
import { getInsights } from "@/lib/ai";

export type ReportData = { title: string; headers: string[]; rows: string[][]; summary: string[] };

export async function buildReport(type: string, from: Date, to: Date): Promise<ReportData> {
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const txns = await db.select().from(transactions).where(and(gte(transactions.date, from), lte(transactions.date, end))).orderBy(asc(transactions.date));
  const exp = txns.filter((t) => t.type === "expense");
  const inc = txns.filter((t) => t.type === "income");
  const tExp = sum(exp.map((t) => t.amount));
  const tInc = sum(inc.map((t) => t.amount));
  const period = `${fmtDate(from)} - ${fmtDate(end)}`;
  const txRow = (t: (typeof txns)[number]) => [fmtDate(t.date), t.merchant, t.category, t.type, t.paymentMethod, String(t.amount), String(t.tax)];
  const txHeaders = ["Date", "Merchant", "Category", "Type", "Payment", "Amount", "Tax"];
  const base = [`Period: ${period}`, `Total income: ${money(tInc)}`, `Total expenses: ${money(tExp)}`, `Net savings: ${money(tInc - tExp)}`];

  switch (type) {
    case "expenses":
      return { title: "Expense Report", headers: txHeaders, rows: exp.map(txRow), summary: [`Period: ${period}`, `Total expenses: ${money(tExp)}`, `Transactions: ${exp.length}`] };
    case "income":
      return { title: "Income Report", headers: txHeaders, rows: inc.map(txRow), summary: [`Period: ${period}`, `Total income: ${money(tInc)}`, `Transactions: ${inc.length}`] };
    case "tax": {
      const taxed = exp.filter((t) => t.tax > 0);
      return { title: "Tax Report (GST paid)", headers: txHeaders, rows: taxed.map(txRow), summary: [`Period: ${period}`, `Total GST/tax paid: ${money(sum(taxed.map((t) => t.tax)))}`, `Taxable purchases: ${taxed.length}`, `Taxable income: ${money(tInc)}`] };
    }
    case "budget": {
      const bs = await db.select().from(budgets);
      const months = Math.max(1, Math.round((end.getTime() - from.getTime()) / (30 * 86400000)));
      const rows = bs.map((b) => {
        const spent = sum(exp.filter((t) => b.category === "Overall" || t.category === b.category).map((t) => t.amount));
        const limit = b.limitAmount * months;
        return [b.category, String(limit), String(Math.round(spent)), String(Math.round(limit - spent)), `${Math.round((spent / limit) * 100)}%`];
      });
      return { title: "Budget Report", headers: ["Category", "Budget", "Spent", "Remaining", "Used"], rows, summary: [`Period: ${period}`, `Budget periods: ${months} month(s)`] };
    }
    case "annual":
    case "monthly": {
      const map = new Map<string, { inc: number; exp: number }>();
      for (const t of txns) {
        const k = type === "annual" ? `${MONTHS[t.date.getMonth()]} ${t.date.getFullYear()}` : fmtDate(t.date);
        const o = map.get(k) ?? { inc: 0, exp: 0 };
        if (t.type === "income") o.inc += t.amount;
        else o.exp += t.amount;
        map.set(k, o);
      }
      const rows = [...map.entries()].map(([k, v]) => [k, String(Math.round(v.inc)), String(Math.round(v.exp)), String(Math.round(v.inc - v.exp))]);
      return { title: type === "annual" ? "Annual Financial Report" : "Monthly Financial Report", headers: [type === "annual" ? "Month" : "Date", "Income", "Expenses", "Net"], rows, summary: base };
    }
    default: {
      const ins = await getInsights();
      const cat = new Map<string, number>();
      for (const t of exp) cat.set(t.category, (cat.get(t.category) ?? 0) + t.amount);
      const rows = [...cat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, String(Math.round(v)), `${tExp ? Math.round((v / tExp) * 100) : 0}%`]);
      
      const summaryLines = [
        ...base,
        `Financial health score: ${ins.health.score}/100 (${ins.health.label})`,
        `Forecast next month spend: ${money(ins.predictions.nextMonthTotal)}`,
        "",
        "AI Insights:",
        ...ins.insights.slice(0, 6).map((i) => `- ${i.title}: ${i.body}`),
        "",
        "Recommendations:",
        ...ins.advice.slice(0, 4).map((a) => `- ${a.title}: ${a.body}`)
      ];

      // Use Groq LLM for a deeper AI summary if key is available
      try {
        const groqKey = process.env.GROQ_API_KEY ?? "";
        const groqModel = process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b";
        if (groqKey) {
          const recent = exp.slice(-20).map((t) => `${t.merchant} (₹${t.amount})`).join(", ");
          const prompt = `You are an expert AI financial analyst. Write a concise 2-3 sentence executive summary for this financial report.
Total Income: ₹${tInc}, Total Expenses: ₹${tExp}, Net Savings: ₹${tInc - tExp}.
Top categories: ${rows.slice(0, 3).map((r) => `${r[0]} ₹${r[1]}`).join(", ")}.
Recent transactions: ${recent}.
Keep it professional, insightful, and in plain text. Use ₹ for currency.`;

          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
            body: JSON.stringify({
              model: groqModel,
              messages: [{ role: "user", content: prompt }],
              stream: false,
              max_tokens: 200,
              temperature: 0.5,
            }),
          });
          if (res.ok) {
            const json = await res.json();
            const aiText: string = json.choices?.[0]?.message?.content ?? "";
            if (aiText.trim()) summaryLines.push("", "AI Executive Summary:", aiText.trim());
          }
        }
      } catch (e) {
        console.warn("[report] LLM summary skipped:", e);
      }

      return {
        title: "AI Financial Report",
        headers: ["Category", "Spent", "Share"],
        rows,
        summary: summaryLines,
      };
    }
  }
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(d: ReportData) {
  return [d.headers, ...d.rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function toXls(d: ReportData) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<html><head><meta charset="utf-8"></head><body><h3>${esc(d.title)}</h3>${d.summary.map((s) => `<p>${esc(s)}</p>`).join("")}<table border="1"><tr>${d.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${d.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
}

export function toPdf(d: ReportData): Buffer {
  const clean = (s: string) => s.replace(/₹/g, "Rs.").replace(/[^\x20-\x7E]/g, "-");
  const widths = d.headers.map((h, i) => Math.min(24, Math.max(h.length, ...d.rows.slice(0, 200).map((r) => (r[i] ?? "").length))));
  const fmt = (r: string[]) => r.map((c, i) => clean(c ?? "").slice(0, widths[i]).padEnd(widths[i])).join("  ");
  const lines = [clean(d.title).toUpperCase(), "", ...d.summary.map(clean), "", fmt(d.headers), "-".repeat(Math.min(105, sum(widths) + 2 * widths.length)), ...d.rows.map(fmt)].map((l) => l.slice(0, 105));
  const perPage = 62;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const objs: string[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  pages.forEach((pg, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${5 + 2 * i} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    const stream = `BT /F1 8 Tf 40 805 Td 12 TL ${pg.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
