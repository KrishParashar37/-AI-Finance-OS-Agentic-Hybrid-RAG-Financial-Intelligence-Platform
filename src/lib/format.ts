import clsx, { type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

let currency = "INR";
const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function setCurrency(c: string) {
  currency = c;
}
export function getCurrency() {
  return currency;
}

export function money(n: number, opts?: { sign?: boolean; decimals?: number }) {
  const sym = SYMBOLS[currency] ?? "₹";
  const abs = Math.abs(n || 0);
  const d = opts?.decimals ?? 0;
  const s = abs.toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
  const sign = n < 0 ? "-" : opts?.sign && n > 0 ? "+" : "";
  return `${sign}${sym}${s}`;
}

export function compact(n: number) {
  const sym = SYMBOLS[currency] ?? "₹";
  const a = Math.abs(n);
  if (currency === "INR") {
    if (a >= 1e7) return `${sym}${(n / 1e7).toFixed(1)}Cr`;
    if (a >= 1e5) return `${sym}${(n / 1e5).toFixed(1)}L`;
  } else if (a >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}k`;
  return `${sym}${Math.round(n)}`;
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function shortDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function toInputDate(d: string | Date = new Date()) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export function timeAgo(d: string | Date) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
}

export function daysUntil(d: string | Date) {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function pctText(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
