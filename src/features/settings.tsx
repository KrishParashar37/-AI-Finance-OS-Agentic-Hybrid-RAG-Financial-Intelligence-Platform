"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Download, Laptop, Loader2, Monitor, Moon, Smartphone, Sun, Trash2, Upload } from "lucide-react";
import { Card, PageHeader, SectionTitle, Segmented, Switch, Async, ListSkeleton, Badge } from "@/components/ui";
import { Field } from "@/components/forms";
import { useSettings } from "@/components/providers";
import { useConfirm, useToast } from "@/components/feedback";
import { api, request, useApi } from "@/hooks/useApi";
import { cn, timeAgo } from "@/lib/format";
import { downloadBlob } from "@/lib/client-utils";
import type { Activity, TxnList } from "@/lib/types";
import { Settings as SettingsIcon } from "lucide-react";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings", label: "General" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/connected-apps", label: "Connected Apps" },
  { href: "/settings/data", label: "Data & Backup" },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, security and preferences" icon={SettingsIcon} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
          {TABS.map((t) => <Link key={t.href} href={t.href} aria-current={pathname === t.href ? "page" : undefined} className={cn("shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition", pathname === t.href ? "bg-grad text-white shadow-md" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5")}>{t.label}</Link>)}
        </nav>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-3.5"><div><p className="text-sm font-medium">{title}</p>{desc && <p className="text-xs text-slate-500">{desc}</p>}</div>{children}</div>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function useGroup(key: string) {
  const { settings, save } = useSettings();
  const toast = useToast();
  const value: Record<string, any> = settings[key] ?? {};
  const update = async (patch: Record<string, any>, msg?: string) => {
    try {
      await save(key, { ...value, ...patch });
      if (msg) toast.success(msg);
    } catch {
      toast.error("Could not save settings");
    }
  };
  return { value, update };
}

export function ProfileSettings() {
  const { value, update } = useGroup("profile");
  const toast = useToast();
  const [f, setF] = useState<{ name?: string; email?: string; phone?: string; bio?: string; monthlyIncomeTarget?: number } | null>(null);
  const cur = f ?? { name: value.name ?? "", email: value.email ?? "", phone: value.phone ?? "", bio: value.bio ?? "", monthlyIncomeTarget: value.monthlyIncomeTarget ?? 0 };
  const set = (k: string, v: string | number) => setF({ ...cur, [k]: v });
  return (
    <Card className="!p-6">
      <SectionTitle title="Profile" sub="Your personal information" />
      <div className="mb-6 flex items-center gap-4"><span className="bg-grad grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-white">{(cur.name || "K")[0]}</span><div><p className="font-semibold">{cur.name || "Your name"}</p><p className="text-sm text-slate-500">{cur.email}</p></div></div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (!cur.name?.trim()) return toast.error("Name is required"); if (!/^\S+@\S+\.\S+$/.test(cur.email ?? "")) return toast.error("Enter a valid email"); await update(cur, "Profile saved"); setF(null); }}>
        <Field label="Full name"><input className="input" value={cur.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={cur.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={cur.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Monthly income target"><input className="input" type="number" min="0" value={cur.monthlyIncomeTarget} onChange={(e) => set("monthlyIncomeTarget", Number(e.target.value))} /></Field>
        <Field label="Bio" className="sm:col-span-2"><textarea className="input min-h-20" value={cur.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
        <div className="sm:col-span-2"><button className="btn btn-primary">Save changes</button></div>
      </form>
    </Card>
  );
}

export function GeneralSettings() {
  const pref = useGroup("preferences");
  const priv = useGroup("privacy");
  return (
    <>
      <Card className="!p-6">
        <SectionTitle title="Preferences" />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          <Row title="Currency" desc="Display symbol and number format"><select className="input !w-40" value={pref.value.currency ?? "INR"} onChange={(e) => pref.update({ currency: e.target.value }, "Currency updated")} aria-label="Currency">{[["INR", "₹ Indian Rupee"], ["USD", "$ US Dollar"], ["EUR", "€ Euro"], ["GBP", "£ British Pound"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
          <Row title="Language" desc="Saved preference — interface translations are rolling out"><select className="input !w-40" value={pref.value.language ?? "en"} onChange={(e) => pref.update({ language: e.target.value }, "Language preference saved")} aria-label="Language">{[["en", "English"], ["hi", "हिन्दी"], ["mr", "मराठी"], ["ta", "தமிழ்"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
          <Row title="Week starts on"><Segmented size="sm" value={pref.value.weekStart ?? "monday"} onChange={(v) => pref.update({ weekStart: v })} options={[{ value: "monday", label: "Mon" }, { value: "sunday", label: "Sun" }]} /></Row>
          <Row title="Auto-categorise expenses" desc="AI suggests a category from the merchant name"><Switch label="Auto categorise" checked={pref.value.autoCategorize !== false} onChange={(v) => pref.update({ autoCategorize: v })} /></Row>
        </div>
      </Card>
      <Card className="!p-6">
        <SectionTitle title="Privacy" />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          <Row title="Hide balances" desc="Blur amounts across the app"><Switch label="Hide balances" checked={!!priv.value.hideBalances} onChange={(v) => priv.update({ hideBalances: v }, v ? "Balances hidden" : "Balances visible")} /></Row>
          <Row title="Usage analytics" desc="Help improve the product"><Switch label="Usage analytics" checked={priv.value.analytics !== false} onChange={(v) => priv.update({ analytics: v })} /></Row>
          <Row title="Share anonymous data" desc="Contribute to spending benchmarks"><Switch label="Share anonymous data" checked={!!priv.value.shareAnonymousData} onChange={(v) => priv.update({ shareAnonymousData: v })} /></Row>
        </div>
      </Card>
    </>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
export function StrengthMeter({ value }: { value: string }) {
  const s = strength(value);
  const colors = ["bg-slate-200", "bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];
  return <div className="mt-2"><div className="flex gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= s ? colors[s] : "bg-slate-200 dark:bg-white/10")} />)}</div><p className="mt-1 text-xs text-slate-500">{value ? ["Too weak", "Weak", "Fair", "Good", "Strong"][s] : "Use 8+ characters with numbers & symbols"}</p></div>;
}

export function SecuritySettings() {
  const sec = useGroup("security");
  const toast = useToast();
  const activity = useApi<Activity[]>("/api/resources/activity");
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Card className="!p-6">
        <SectionTitle title="Change password" sub="Demo environment — passwords are validated but not stored" />
        <form className="grid max-w-md gap-4" onSubmit={async (e) => { e.preventDefault(); if (!pw.cur) return toast.error("Enter your current password"); if (strength(pw.next) < 3) return toast.error("Choose a stronger password"); if (pw.next !== pw.confirm) return toast.error("Passwords don't match"); setBusy(true); await new Promise((r) => setTimeout(r, 600)); setBusy(false); setPw({ cur: "", next: "", confirm: "" }); toast.success("Password updated"); }}>
          <Field label="Current password"><input type="password" className="input" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="New password"><input type="password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /><StrengthMeter value={pw.next} /></Field>
          <Field label="Confirm new password"><input type="password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
          <div><button className="btn btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button></div>
        </form>
      </Card>
      <Card className="!p-6">
        <SectionTitle title="Two-factor & alerts" />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          <Row title="Two-factor authentication" desc="Require a 6-digit code when signing in"><Switch label="Two-factor authentication" checked={!!sec.value.twoFactor} onChange={(v) => sec.update({ twoFactor: v }, v ? "2FA enabled" : "2FA disabled")} /></Row>
          <Row title="Login alerts" desc="Notify me about new device sign-ins"><Switch label="Login alerts" checked={sec.value.loginAlerts !== false} onChange={(v) => sec.update({ loginAlerts: v })} /></Row>
        </div>
      </Card>
      <Card className="!p-6">
        <SectionTitle title="Active sessions" />
        <ul className="divide-y divide-slate-100 dark:divide-white/5">{[{ icon: Laptop, d: "This browser", m: "Current session", cur: true }, { icon: Smartphone, d: "Pixel 8 · Android", m: "Mumbai, IN · 2 days ago", cur: false }].map((s) => <li key={s.d} className="flex items-center gap-3 py-3"><s.icon className="h-5 w-5 text-slate-400" /><div className="flex-1"><p className="text-sm font-medium">{s.d}</p><p className="text-xs text-slate-500">{s.m}</p></div>{s.cur ? <Badge tone="green">Active</Badge> : <button className="btn btn-ghost btn-sm !text-rose-500" onClick={() => toast.success("Session signed out")}>Sign out</button>}</li>)}</ul>
      </Card>
      <Card className="!p-6"><SectionTitle title="Recent activity" /><Async q={activity} skeleton={<ListSkeleton rows={3} h="h-10" />}>{(a) => <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">{a.slice(0, 6).map((x) => <li key={x.id} className="flex justify-between gap-3 py-2.5"><span><b>{x.action}</b> <span className="text-slate-500">{x.detail}</span></span><span className="shrink-0 text-xs text-slate-400">{timeAgo(x.createdAt)}</span></li>)}</ul>}</Async></Card>
    </>
  );
}

const APPS = [
  { key: "gmail", name: "Gmail", desc: "Auto-import e-receipts from your inbox", emoji: "📧" },
  { key: "googleDrive", name: "Google Drive", desc: "Back up reports and receipts", emoji: "☁️" },
  { key: "hdfc", name: "HDFC Bank", desc: "Sync bank transactions via Account Aggregator", emoji: "🏦" },
  { key: "paytm", name: "Paytm", desc: "Import UPI & wallet history", emoji: "📱" },
  { key: "zerodha", name: "Zerodha", desc: "Track investment portfolio value", emoji: "📈" },
  { key: "slack", name: "Slack", desc: "Send budget alerts to a channel", emoji: "💬" },
];
export function ConnectedApps() {
  const apps = useGroup("connectedApps");
  return (
    <Card className="!p-6">
      <SectionTitle title="Connected apps" sub="Connections are simulated in this demo" />
      <ul className="divide-y divide-slate-100 dark:divide-white/5">{APPS.map((a) => { const on = !!apps.value[a.key]; return <li key={a.key} className="flex items-center gap-4 py-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl dark:bg-white/10">{a.emoji}</span><div className="flex-1"><p className="font-medium">{a.name} {on && <Badge tone="green">Connected</Badge>}</p><p className="text-xs text-slate-500">{a.desc}</p></div><button className={cn("btn btn-sm", on ? "btn-secondary" : "btn-primary")} onClick={() => apps.update({ [a.key]: !on }, on ? `${a.name} disconnected` : `${a.name} connected`)}>{on ? "Disconnect" : "Connect"}</button></li>; })}</ul>
    </Card>
  );
}

export function NotificationSettings() {
  const n = useGroup("notifications");
  const items = [["email", "Email notifications", "Receive summaries by email"], ["push", "Push notifications", "Browser and mobile alerts"], ["budgetAlerts", "Budget alerts", "When you near or exceed a budget"], ["billReminders", "Bill reminders", "3 days before a bill is due"], ["anomalyAlerts", "Fraud & anomaly alerts", "Suspicious or duplicate transactions"], ["aiInsights", "AI insights", "New personalised insights"], ["weeklyDigest", "Weekly digest", "Every Monday morning"]];
  return <Card className="!p-6"><SectionTitle title="Notification preferences" /><div className="divide-y divide-slate-100 dark:divide-white/5">{items.map(([k, t, d]) => <Row key={k} title={t} desc={d}><Switch label={t} checked={!!n.value[k]} onChange={(v) => n.update({ [k]: v })} /></Row>)}</div></Card>;
}

export function AppearanceSettings() {
  const a = useGroup("appearance");
  const accents = [["indigo", "#6366f1"], ["emerald", "#10b981"], ["rose", "#f43f5e"], ["amber", "#f59e0b"], ["sky", "#0ea5e9"]];
  return (
    <>
      <Card className="!p-6"><SectionTitle title="Theme" /><div className="grid grid-cols-3 gap-3">{[["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]].map(([v, l, Icon]) => { const I = Icon as typeof Sun; const on = (a.value.theme ?? "system") === v; return <button key={v as string} onClick={() => a.update({ theme: v })} className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 transition", on ? "border-[color:var(--ac1)] bg-indigo-500/5 ring-2 ring-[color:var(--ac1)]/20" : "border-slate-200 dark:border-white/10")}><I className="h-6 w-6" /><span className="text-sm font-medium">{l as string}</span></button>; })}</div></Card>
      <Card className="!p-6"><SectionTitle title="Accent colour" /><div className="flex gap-3">{accents.map(([n, c]) => <button key={n} aria-label={n} onClick={() => a.update({ accent: n })} className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-white ring-offset-2 transition hover:scale-110" style={{ background: c, boxShadow: (a.value.accent ?? "indigo") === n ? `0 0 0 3px ${c}55` : undefined }}>{(a.value.accent ?? "indigo") === n && <Check className="h-5 w-5" />}</button>)}</div></Card>
      <Card className="!p-6"><div className="divide-y divide-slate-100 dark:divide-white/5"><Row title="Density" desc="Compact fits more on screen"><Segmented size="sm" value={a.value.density ?? "comfortable"} onChange={(v) => a.update({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></Row><Row title="Animations" desc="Page transitions and micro-interactions"><Switch label="Animations" checked={a.value.animations !== false} onChange={(v) => a.update({ animations: v })} /></Row></div></Card>
    </>
  );
}

export function DataManagement() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const activity = useApi<Activity[]>("/api/resources/activity");
  const [busy, setBusy] = useState("");
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    setBusy("");
  };
  const exportCsv = () => run("csv", async () => {
    const rows: TxnList["items"] = [];
    for (let p = 1; p < 20; p++) { const r = await request<TxnList>(`/api/transactions?limit=200&page=${p}`); rows.push(...r.items); if (rows.length >= r.total) break; }
    const esc = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
    downloadBlob([["Date", "Type", "Merchant", "Category", "Amount", "Tax", "Payment", "Notes"], ...rows.map((t) => [t.date.slice(0, 10), t.type, t.merchant, t.category, String(t.amount), String(t.tax), t.paymentMethod, t.notes])].map((r) => r.map(esc).join(",")).join("\n"), "transactions.csv", "text/csv");
    toast.success(`Exported ${rows.length} transactions`);
  });
  const restore = (file: File) => run("restore", async () => {
    let data: unknown;
    try { data = JSON.parse(await file.text()); } catch { throw new Error("That file isn't valid JSON"); }
    if (!(await confirm({ title: "Restore from backup?", message: "This replaces ALL current data with the contents of the backup.", confirmText: "Restore", danger: true }))) return;
    await api.post("/api/data", { action: "restore", data });
    toast.success("Backup restored");
    router.refresh();
    activity.reload();
  });
  return (
    <>
      <Card className="!p-6"><SectionTitle title="Export & backup" />
        <div className="grid gap-3 sm:grid-cols-3">
          <a href="/api/data/export" className="btn btn-secondary"><Download className="h-4 w-4" /> Backup (JSON)</a>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={busy === "csv"}>{busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Transactions CSV</button>
          <label className="btn btn-secondary cursor-pointer"><Upload className="h-4 w-4" /> Restore backup<input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} /></label>
        </div>
      </Card>
      <Card className="!p-6"><SectionTitle title="Activity log" action={<button className="text-xs font-medium text-rose-500" onClick={async () => { if (await confirm({ title: "Clear activity log?", confirmText: "Clear", danger: true })) { await api.del("/api/resources/activity"); activity.reload(); toast.success("Activity log cleared"); } }}>Clear</button>} />
        <Async q={activity} skeleton={<ListSkeleton rows={4} h="h-10" />}>{(a) => a.length === 0 ? <p className="text-sm text-slate-500">No activity recorded.</p> : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-white/5">{a.slice(0, 40).map((x) => <li key={x.id} className="flex justify-between gap-3 py-2.5"><span><b>{x.action}</b> <span className="text-slate-500">{x.detail}</span></span><span className="shrink-0 text-xs text-slate-400">{timeAgo(x.createdAt)}</span></li>)}</ul>}</Async>
      </Card>
      <Card className="!border-rose-300/60 !p-6 dark:!border-rose-500/30"><SectionTitle title="Danger zone" />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          <Row title="Load demo data" desc="Replace everything with sample data"><button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run("demo", async () => { if (await confirm({ title: "Load demo data?", message: "All existing data will be replaced.", confirmText: "Load demo" })) { await api.post("/api/data", { action: "demo" }); toast.success("Demo data loaded"); router.push("/"); router.refresh(); } })}>Load demo</button></Row>
          <Row title="Reset all data" desc="Delete every transaction, budget, goal and account"><button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => run("reset", async () => { if (await confirm({ title: "Erase all data?", message: "This permanently deletes all financial data. Export a backup first.", confirmText: "Erase everything", danger: true })) { await api.post("/api/data", { action: "reset" }); toast.success("All data erased"); router.push("/"); router.refresh(); } })}><Trash2 className="h-4 w-4" /> Reset</button></Row>
          <Row title="Delete account" desc="Erases your data and signs you out"><button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => run("delete", async () => { if (await confirm({ title: "Delete your account?", message: "All data is permanently erased and you'll be signed out. This cannot be undone.", confirmText: "Delete account", danger: true })) { await api.post("/api/data", { action: "reset" }); toast.success("Account deleted"); router.push("/signup"); } })}>Delete account</button></Row>
        </div>
      </Card>
    </>
  );
}
