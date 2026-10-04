import type { NextRequest } from "next/server";
import { db } from "@/db";
import { scans, type ScanItem } from "@/db/schema";
import { route, bad } from "@/lib/api";
import { logActivity } from "@/lib/log";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

/*
 * Demo extraction engine: deterministic per file (name + size) so results are stable.
 * Swap `extract()` for a real OCR / vision provider (Tesseract, Google Vision, GPT-4o…) in production.
 */
const RECEIPT_MERCHANTS = [
  { m: "Amazon", c: "Shopping", pay: "UPI", min: 499, max: 4800, items: ["Wireless Mouse", "USB-C Cable", "Phone Case", "Bluetooth Speaker", "Notebook Set"] },
  { m: "Zomato", c: "Food", pay: "UPI", min: 220, max: 780, items: ["Paneer Tikka Bowl", "Veg Biryani", "Cold Coffee", "Garlic Naan", "Brownie"] },
  { m: "Starbucks", c: "Food", pay: "Debit Card", min: 280, max: 840, items: ["Caffe Latte", "Cappuccino", "Blueberry Muffin", "Cold Brew"] },
  { m: "BigBasket", c: "Groceries", pay: "UPI", min: 650, max: 3200, items: ["Basmati Rice 5kg", "Amul Milk 1L", "Eggs (12)", "Tomatoes 1kg", "Olive Oil"] },
  { m: "DMart", c: "Groceries", pay: "Debit Card", min: 900, max: 3600, items: ["Atta 10kg", "Sugar 2kg", "Detergent", "Biscuits", "Dal 1kg"] },
  { m: "Uber", c: "Transport", pay: "UPI", min: 140, max: 680, items: ["Ride fare", "Booking fee", "Tip"] },
  { m: "Apollo Pharmacy", c: "Health", pay: "UPI", min: 180, max: 1600, items: ["Paracetamol", "Vitamin D3", "Cough Syrup", "Bandages"] },
  { m: "PVR Cinemas", c: "Entertainment", pay: "Credit Card", min: 420, max: 1500, items: ["Movie Ticket x2", "Popcorn Combo", "Cold Drink"] },
  { m: "Reliance Digital", c: "Shopping", pay: "Credit Card", min: 1500, max: 9000, items: ["HDMI Cable", "Power Bank", "Earphones"] },
];
const INVOICE_VENDORS = [
  { m: "AWS India", c: "Bills", pay: "Net Banking", min: 1800, max: 9000, items: ["EC2 Compute", "S3 Storage", "Data Transfer"] },
  { m: "Adobe Systems", c: "Subscriptions", pay: "Credit Card", min: 1500, max: 2400, items: ["Creative Cloud (monthly)"] },
  { m: "Tata Power", c: "Bills", pay: "UPI", min: 1200, max: 3200, items: ["Electricity charges", "Fixed charges"] },
  { m: "Urban Company", c: "Other", pay: "UPI", min: 600, max: 3200, items: ["Home cleaning", "AC service"] },
  { m: "Apollo Hospitals", c: "Health", pay: "Credit Card", min: 1500, max: 12000, items: ["Consultation", "Lab tests", "Medicines"] },
];
const TAX: Record<string, number> = { Shopping: 0.18, Entertainment: 0.18, Bills: 0.18, Food: 0.05, Groceries: 0.05, Health: 0.05, Subscriptions: 0.18, Other: 0.18 };

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function prng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function extract(name: string, size: number, kind: string) {
  const h = hash(`${name}:${size}`);
  const r = prng(h);
  const pool = kind === "invoice" ? INVOICE_VENDORS : RECEIPT_MERCHANTS;
  const lower = name.toLowerCase();
  const hinted = pool.find((p) => lower.includes(p.m.toLowerCase().split(" ")[0]));
  const mer = hinted ?? pool[h % pool.length];
  const total = Math.round(mer.min + r() * (mer.max - mer.min));
  const rate = TAX[mer.c] ?? 0.18;
  const tax = Math.round((total * rate) / (1 + rate));
  const n = Math.min(mer.items.length, 2 + Math.floor(r() * 3));
  const weights = Array.from({ length: n }, () => 0.5 + r());
  const wSum = weights.reduce((a, b) => a + b, 0);
  const sub = total - tax;
  const items: ScanItem[] = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const price = i === n - 1 ? sub - used : Math.round((sub * weights[i]) / wSum);
    used += price;
    items.push({ name: mer.items[i], qty: 1 + Math.floor(r() * 2) * (i === 0 ? 1 : 0), price });
  }
  const date = new Date();
  date.setDate(date.getDate() - (h % 4));
  date.setHours(12, 0, 0, 0);
  return { mer, total, tax, items, date, confidence: 88 + (h % 11), invoiceNumber: `INV-${date.getFullYear()}-${1000 + (h % 9000)}` };
}

export const POST = route(async (req: NextRequest) => {
  const form = await req.formData();
  const kind = form.get("kind") === "invoice" ? "invoice" : "receipt";
  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (!files.length) return bad("Please attach at least one file");
  const out = [];
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) return bad(`${file.name} is larger than 10MB`);
    const ok = /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.type) || /\.(jpe?g|png|pdf|webp)$/i.test(file.name);
    if (!ok) return bad(`${file.name}: unsupported file type (use JPG, PNG or PDF)`);
    const x = extract(file.name, file.size, kind);
    let previewUrl = "";
    if (file.type.startsWith("image/") && file.size <= 2.5 * 1024 * 1024) {
      const buf = Buffer.from(await file.arrayBuffer());
      previewUrl = `data:${file.type};base64,${buf.toString("base64")}`;
    }
    const [row] = await db
      .insert(scans)
      .values({ fileName: file.name, fileSize: file.size, kind, merchant: x.mer.m, date: x.date, total: x.total, tax: x.tax, category: x.mer.c, paymentMethod: x.mer.pay, confidence: x.confidence, items: x.items, previewUrl })
      .$returningId();
    out.push({ ...row, fileName: file.name, fileSize: file.size, kind, merchant: x.mer.m, date: x.date, total: x.total, tax: x.tax, category: x.mer.c, paymentMethod: x.mer.pay, confidence: x.confidence, items: x.items, status: "processed", previewUrl, invoiceNumber: x.invoiceNumber });
  }
  await logActivity(kind === "invoice" ? "Invoice scanned" : "Receipt scanned", out.map((o) => `${o.fileName} → ${o.merchant} ${money(o.total)}`).join("; ").slice(0, 200));
  return { scans: out };
});
