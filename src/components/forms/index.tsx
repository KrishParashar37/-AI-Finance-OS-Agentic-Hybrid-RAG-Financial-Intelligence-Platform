"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { api, useApi } from "@/hooks/useApi";
import { useToast } from "@/components/feedback";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { cn, toInputDate, fmtDate } from "@/lib/format";
import type { Account, Txn } from "@/lib/types";

export function Field({ label, children, error, hint, className }: { label: string; children: ReactNode; error?: string; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-500" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function MultiSelect({ options, value, onChange, placeholder = "Select…" }: { options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex cursor-pointer items-center justify-between text-left" aria-expanded={open}>
        <span className={cn("truncate", !value.length && "text-slate-400")}>{value.length ? value.join(", ") : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {options.map((o) => (
            <button type="button" key={o} onClick={() => toggle(o)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10">
              <span className={cn("grid h-4 w-4 place-items-center rounded border", value.includes(o) ? "bg-grad border-transparent text-white" : "border-slate-300 dark:border-white/20")}>{value.includes(o) && <Check className="h-3 w-3" />}</span>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function presetRanges() {
  const now = new Date();
  const d = (y: number, m: number, day: number) => toInputDate(new Date(y, m, day));
  const y = now.getFullYear();
  const m = now.getMonth();
  const ago = (n: number) => toInputDate(new Date(now.getTime() - n * 86400000));
  return [
    { label: "Today", from: toInputDate(now), to: toInputDate(now) },
    { label: "Last 7 days", from: ago(6), to: toInputDate(now) },
    { label: "Last 30 days", from: ago(29), to: toInputDate(now) },
    { label: "This month", from: d(y, m, 1), to: toInputDate(now) },
    { label: "Last month", from: d(y, m - 1, 1), to: d(y, m, 0) },
    { label: "This year", from: d(y, 0, 1), to: toInputDate(now) },
  ];
}

export function DateRangePicker({ from, to, onChange, align = "left" }: { from: string; to: string; onChange: (from: string, to: string) => void; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex cursor-pointer items-center gap-2 text-left" aria-expanded={open}>
        <Calendar className="h-4 w-4 text-slate-400" />
        <span className={cn("flex-1 truncate", !from && !to && "text-slate-400")}>{from || to ? `${from ? fmtDate(from) : "Start"} → ${to ? fmtDate(to) : "End"}` : "Any date"}</span>
      </button>
      {open && (
        <div className={cn("absolute z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900", align === "right" ? "right-0" : "left-0")}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {presetRanges().map((p) => (
              <button type="button" key={p.label} onClick={() => { onChange(p.from, p.to); setOpen(false); }} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium hover:bg-indigo-100 hover:text-indigo-700 dark:bg-white/10 dark:hover:bg-indigo-500/20">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><input type="date" className="input" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} /></Field>
            <Field label="To"><input type="date" className="input" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} /></Field>
          </div>
          <div className="mt-3 flex justify-between">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange("", ""); setOpen(false); }}>Clear</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

const KEYWORDS: Record<string, string[]> = {
  Food: ["zomato", "swiggy", "starbucks", "restaurant", "cafe", "pizza", "burger", "mcdonald", "kfc", "dominos", "barbeque", "dine"],
  Shopping: ["amazon", "flipkart", "myntra", "ajio", "mall", "store", "nykaa", "reliance digital"],
  Transport: ["uber", "ola", "petrol", "fuel", "metro", "rapido", "irctc", "parking", "toll"],
  Groceries: ["bigbasket", "dmart", "grocery", "blinkit", "zepto", "supermarket", "instamart"],
  Entertainment: ["pvr", "bookmyshow", "cinema", "movie", "game", "inox"],
  Bills: ["electricity", "airtel", "jio", "broadband", "water", "gas", "recharge", "bill"],
  Health: ["pharmacy", "apollo", "hospital", "clinic", "doctor", "medic", "lab"],
  Travel: ["makemytrip", "goibibo", "flight", "hotel", "airbnb", "oyo", "indigo"],
  Education: ["udemy", "coursera", "school", "college", "course", "books"],
  Subscriptions: ["netflix", "spotify", "adobe", "chatgpt", "prime", "hotstar", "youtube"],
};
export function suggestCategory(merchant: string): string | null {
  const m = merchant.toLowerCase();
  for (const [cat, words] of Object.entries(KEYWORDS)) if (words.some((w) => m.includes(w))) return cat;
  return null;
}

export function TransactionForm({ type, initial, onSaved, onCancel }: { type: "expense" | "income"; initial?: Txn; onSaved?: (row: Txn) => void; onCancel?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const accounts = useApi<Account[]>("/api/resources/accounts");
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [f, setF] = useState({
    merchant: initial?.merchant ?? "",
    amount: initial ? String(initial.amount) : "",
    tax: initial ? String(initial.tax) : "",
    date: toInputDate(initial?.date ?? new Date()),
    category: initial?.category ?? cats[0],
    paymentMethod: initial?.paymentMethod ?? "UPI",
    accountId: initial?.accountId ? String(initial.accountId) : "",
    notes: initial?.notes ?? "",
    recurring: initial?.recurring ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const base = type === "income" ? "income" : "expenses";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.merchant.trim()) errs.merchant = type === "income" ? "Source is required" : "Merchant is required";
    if (!f.amount || Number(f.amount) <= 0) errs.amount = "Enter an amount greater than 0";
    if (!f.date) errs.date = "Pick a date";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const payload = { ...f, type, amount: Number(f.amount), tax: Number(f.tax) || 0, accountId: f.accountId ? Number(f.accountId) : null };
      const row = initial ? await api.patch<Txn>(`/api/transactions/${initial.id}`, payload) : await api.post<Txn>("/api/transactions", payload);
      toast.success(initial ? "Transaction updated" : type === "income" ? "Income added" : "Expense added");
      if (!initial && row.risk !== "low") toast.info(`⚠️ Flagged as ${row.risk} risk: ${row.riskReason}`);
      if (onSaved) {
        onSaved(row);
        setBusy(false);
      } else router.push(`/${base}/${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <Field label={type === "income" ? "Source" : "Merchant"} error={errors.merchant} className="sm:col-span-2">
        <input className="input" value={f.merchant} placeholder={type === "income" ? "e.g. Acme Technologies" : "e.g. Amazon, Zomato"} onChange={(e) => set("merchant", e.target.value)} onBlur={() => type === "expense" && setSuggested(suggestCategory(f.merchant))} autoFocus />
        {suggested && suggested !== f.category && type === "expense" && (
          <button type="button" onClick={() => { set("category", suggested); setSuggested(null); }} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <Sparkles className="h-3 w-3" /> AI suggests category: {suggested} — apply
          </button>
        )}
      </Field>
      <Field label="Amount" error={errors.amount}>
        <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Date" error={errors.date}>
        <input className="input" type="date" value={f.date} max={toInputDate(new Date(Date.now() + 86400000 * 365))} onChange={(e) => set("date", e.target.value)} />
      </Field>
      <Field label="Category">
        <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Payment method">
        <select className="input" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
          {PAYMENT_METHODS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Account" hint="Balance updates automatically">
        <select className="input" value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
          <option value="">No account</option>
          {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      {type === "expense" && (
        <Field label="Tax / GST included (optional)">
          <input className="input" type="number" min="0" step="0.01" value={f.tax} onChange={(e) => set("tax", e.target.value)} placeholder="0.00" />
        </Field>
      )}
      <Field label="Notes" className="sm:col-span-2">
        <textarea className="input min-h-24" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes…" />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-indigo-500" checked={f.recurring} onChange={(e) => set("recurring", e.target.checked)} />
        <span className="text-sm">Recurring {type === "income" ? "income" : "expense"}</span>
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-secondary" onClick={() => (onCancel ? onCancel() : router.back())}>Cancel</button>
        <button type="submit" className="btn btn-primary min-w-32" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Save changes" : type === "income" ? "Add income" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
