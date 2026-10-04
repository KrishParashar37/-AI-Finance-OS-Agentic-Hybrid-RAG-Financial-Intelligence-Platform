"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Brain, CheckCircle2, Lightbulb, Mic, MicOff, Send, ShieldAlert, ShieldCheck, Sparkles, Trash2, TrendingUp, User } from "lucide-react";
import { Async, Badge, Card, EmptyState, PageHeader, PageSkeleton, SectionTitle, Segmented, StatCard, ProgressBar, CatIcon } from "@/components/ui";
import { AiBadge, InsightCard } from "@/components/cards";
import { ForecastChart, ScoreRing } from "@/components/charts";
import { useToast } from "@/components/feedback";
import { api, useApi } from "@/hooks/useApi";
import { catMeta } from "@/lib/constants";
import { cn, fmtDate, money } from "@/lib/format";
import type { InsightsPayload, SecurityPayload, Txn } from "@/lib/types";

type Bar = { label: string; emoji: string; value: number; pct: number; color: string };
type Msg = { id: number; role: "user" | "ai"; text: string; bars?: Bar[]; streaming?: boolean };

const SUGGESTIONS = ["Where did I spend the most this month?", "Can I save ₹5,000 this month?", "Find unusual expenses", "Predict next month's spending", "Show my subscriptions", "How are my budgets doing?", "Which bills are due?"];

export function AIAssistant() {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: "ai", text: "Hi Krish! 👋 I'm your AI financial assistant. I analyse your real transactions, budgets, bills and goals. What would you like to know?" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const recRef = useRef<any>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, thinking]);

  const msgsRef = useRef<Msg[]>([]);

  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, thinking]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setBusy(true);
    setThinking(true);
    const aiId = idRef.current + 1;
    idRef.current += 2;

    // Build conversation history before adding the new message
    const history = msgsRef.current
      .filter((m) => m.text && !m.streaming)
      .slice(-10)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant" as const, content: m.text }));

    setMsgs((m) => [...m, { id: aiId - 1, role: "user", text: t }, { id: aiId, role: "ai", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, history }),
      });
      if (!res.ok || !res.body) throw new Error("The assistant is unavailable right now.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { t: string; v?: string | Bar[] };
          setThinking(false);
          if (ev.t === "chunk") setMsgs((m) => m.map((x) => (x.id === aiId ? { ...x, text: x.text + (ev.v as string) } : x)));
          else if (ev.t === "bars") setMsgs((m) => m.map((x) => (x.id === aiId ? { ...x, bars: ev.v as Bar[] } : x)));
        }
      }
    } catch (e) {
      setMsgs((m) => m.map((x) => (x.id === aiId ? { ...x, text: e instanceof Error ? e.message : "Something went wrong." } : x)));
      toast.error("Assistant request failed");
    }
    setMsgs((m) => m.map((x) => (x.id === aiId ? { ...x, streaming: false } : x)));
    setThinking(false);
    setBusy(false);
  };

  const toggleVoice = () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Voice input isn't supported in this browser");
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    rec.onresult = (e: any) => setInput(Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>).map((r) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("Couldn't hear that — check microphone permission");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] min-h-[480px] max-w-3xl flex-col md:h-[calc(100dvh-11rem)]">
      <PageHeader title="AI Financial Assistant" subtitle="Ask anything about your money" icon={Bot} actions={<><Link href="/ai/insights" className="btn btn-secondary btn-sm">Insights</Link><button className="btn btn-ghost btn-sm" onClick={() => setMsgs(msgs.slice(0, 1))} disabled={busy}><Trash2 className="h-4 w-4" /> Clear</button></>} />
      <div className="card flex flex-1 flex-col overflow-hidden !p-0">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", m.role === "ai" ? "bg-grad text-white" : "bg-slate-200 dark:bg-white/15")}>{m.role === "ai" ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}</span>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed", m.role === "user" ? "bg-grad text-white" : "bg-slate-100 dark:bg-white/[0.07]")}>
                {m.text ? <p className="whitespace-pre-wrap">{m.text}{m.streaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />}</p> : null}
                {m.bars && (
                  <ul className="mt-3 space-y-2.5">
                    {m.bars.map((b) => (
                      <li key={b.label}>
                        <div className="mb-1 flex justify-between gap-2 text-xs"><span>{b.emoji} {b.label}</span><span className="font-semibold">{b.pct}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, b.pct)}%`, background: b.color }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <span className="bg-grad grid h-9 w-9 place-items-center rounded-full text-white"><Sparkles className="h-4 w-4" /></span>
              <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-4 dark:bg-white/[0.07]" aria-label="AI is typing">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-slate-200/70 p-3 sm:p-4 dark:border-white/10">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => <button key={s} disabled={busy} onClick={() => send(s)} className="shrink-0 cursor-pointer rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-white/10 dark:bg-white/5">{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder={listening ? "Listening…" : "Ask anything about your finances…"} className="input max-h-32 min-h-11 flex-1 resize-none" aria-label="Message" />
            <button type="button" onClick={toggleVoice} className={cn("btn btn-secondary !px-3", listening && "!border-rose-400 !text-rose-500")} aria-label={listening ? "Stop voice input" : "Start voice input"}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
            <button type="submit" className="btn btn-primary !px-4" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AIInsights() {
  const q = useApi<InsightsPayload>("/api/ai/insights");
  const [filter, setFilter] = useState("all");
  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" subtitle="Personalised observations from your data" icon={Brain} actions={<AiBadge>Live analysis</AiBadge>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={4} />}>
        {(d) => {
          const list = d.insights.filter((i) => filter === "all" || i.type === filter);
          const count = (t: string) => d.insights.filter((i) => i.type === t).length;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="!p-4"><p className="text-xs text-slate-500">Health score</p><p className="mt-1 text-2xl font-bold">{d.health.score}<span className="text-sm font-normal text-slate-500">/100</span></p></Card>
                <Card className="!p-4"><p className="text-xs text-slate-500">Alerts</p><p className="mt-1 text-2xl font-bold text-rose-500">{count("alert")}</p></Card>
                <Card className="!p-4"><p className="text-xs text-slate-500">Warnings</p><p className="mt-1 text-2xl font-bold text-amber-500">{count("warning")}</p></Card>
                <Card className="!p-4"><p className="text-xs text-slate-500">Positive</p><p className="mt-1 text-2xl font-bold text-emerald-500">{count("success")}</p></Card>
              </div>
              <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "alert", label: "Alerts" }, { value: "warning", label: "Warnings" }, { value: "info", label: "Info" }, { value: "tip", label: "Tips" }, { value: "success", label: "Wins" }]} />
              {list.length === 0 ? <EmptyState icon={Lightbulb} title="Nothing here" body="No insights in this category." /> : <div className="grid gap-3 lg:grid-cols-2">{list.map((i) => <InsightCard key={i.id} insight={i} />)}</div>}
            </>
          );
        }}
      </Async>
    </div>
  );
}

export function Predictions() {
  const q = useApi<InsightsPayload>("/api/ai/insights");
  return (
    <div className="space-y-6">
      <PageHeader title="Predictions" subtitle="Forecasts from your last 6 months of activity" icon={TrendingUp} actions={<AiBadge>Forecast</AiBadge>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={3} />}>
        {({ predictions: p }) => (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Next month spend" value={p.nextMonthTotal} icon={TrendingUp} sub={`3-mo avg ${money(p.avgExpense)}`} accent="linear-gradient(135deg,#f43f5e,#f97316)" />
              <StatCard label="This month projection" value={p.monthEndProjection} icon={Sparkles} sub="at current pace" />
              <StatCard label="Projected savings" value={p.projectedSavings} icon={CheckCircle2} sub={`income ≈ ${money(p.avgIncome)}`} accent="linear-gradient(135deg,#10b981,#06b6d4)" />
            </div>
            <Card><SectionTitle title="Expense forecast" sub="Solid = actual · Dashed = predicted" /><ForecastChart series={p.series} /></Card>
            <Card className="overflow-x-auto !p-0">
              <div className="p-5 pb-0"><SectionTitle title="Next month by category" /></div>
              <table className="w-full min-w-[480px]">
                <thead className="border-b border-slate-100 dark:border-white/10"><tr><th className="th">Category</th><th className="th text-right">3-mo avg</th><th className="th text-right">Predicted</th><th className="th text-right">Change</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {p.byCategory.map((c) => (
                    <tr key={c.name}><td className="td"><span className="flex items-center gap-3"><CatIcon name={c.name} size="sm" />{c.name}</span></td><td className="td money text-right">{money(c.average)}</td><td className="td money text-right font-semibold">{money(c.predicted)}</td><td className={cn("td text-right font-medium", c.change > 3 ? "text-rose-500" : c.change < -3 ? "text-emerald-500" : "text-slate-500")}>{c.change > 0 ? "+" : ""}{c.change.toFixed(1)}%</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </Async>
    </div>
  );
}

export function Anomalies() {
  const router = useRouter();
  const toast = useToast();
  const q = useApi<SecurityPayload>("/api/security");
  const [filter, setFilter] = useState("all");
  const act = async (t: Txn, kind: "safe" | "fraud") => {
    try {
      await api.patch(`/api/transactions/${t.id}`, kind === "safe" ? { risk: "low", riskReason: "Reviewed: marked safe" } : { risk: "high", riskReason: "Reported as fraud by user" });
      toast.success(kind === "safe" ? "Marked as safe" : "Reported as fraud");
      q.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };
  const level = (t: Txn) => (t.risk !== "low" ? t.risk : t.riskReason.startsWith("Duplicate") ? "duplicate" : "low");
  return (
    <div className="space-y-6">
      <PageHeader title="AI Security Center" subtitle="Fraud, anomaly and duplicate detection" icon={ShieldCheck} actions={<AiBadge>Monitoring</AiBadge>} />
      <Async q={q} skeleton={<PageSkeleton cards={3} rows={4} />}>
        {(d) => {
          const list = d.flagged.filter((t) => filter === "all" || level(t) === filter);
          return (
            <>
              <div className="grid gap-4 lg:grid-cols-4">
                <Card className="text-center lg:row-span-1">
                  <p className="mb-2 text-sm font-medium text-slate-500">Risk Score</p>
                  <ScoreRing score={d.riskScore} size={150} invert label={d.riskScore < 25 ? "Low risk" : d.riskScore < 60 ? "Moderate" : "High risk"} />
                </Card>
                {[
                  { label: "Normal transactions", v: d.normal, icon: CheckCircle2, cls: "text-emerald-500 bg-emerald-500/10" },
                  { label: "Suspicious transactions", v: d.suspicious, icon: ShieldAlert, cls: "text-amber-500 bg-amber-500/10" },
                  { label: "Duplicates", v: d.duplicates, icon: AlertTriangle, cls: "text-sky-500 bg-sky-500/10" },
                ].map((s) => (
                  <Card key={s.label} className="flex flex-col justify-center">
                    <span className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl", s.cls)}><s.icon className="h-5 w-5" /></span>
                    <p className="text-3xl font-bold tabular-nums">{s.v}</p>
                    <p className="text-sm text-slate-500">{s.label}</p>
                  </Card>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle title="Transaction risk" sub="Largest and flagged transactions" />
                <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "duplicate", label: "Duplicates" }, { value: "low", label: "Low" }]} />
              </div>
              {list.length === 0 ? <EmptyState icon={ShieldCheck} title="Nothing to review" body="No transactions match this filter. You're all clear." /> : (
                <div className="space-y-3">
                  {list.map((t) => {
                    const l = level(t);
                    return (
                      <Card key={t.id} className="flex flex-wrap items-center gap-4 !p-4">
                        <CatIcon name={t.category} />
                        <button onClick={() => router.push(`/expenses/${t.id}`)} className="min-w-0 flex-1 cursor-pointer text-left">
                          <p className="font-semibold">{t.merchant} <span className="text-xs font-normal text-slate-400">· {fmtDate(t.date)}</span></p>
                          <p className="truncate text-xs text-slate-500">{t.riskReason || "Matches your normal spending pattern"}</p>
                        </button>
                        <p className="money w-24 text-right font-bold">{money(t.amount)}</p>
                        <Badge tone={l === "high" ? "red" : l === "medium" ? "amber" : l === "duplicate" ? "blue" : "green"} className="w-20 justify-center uppercase">{l}</Badge>
                        {l !== "low" && (
                          <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => act(t, "safe")}>This was me</button>
                            {t.riskReason !== "Reported as fraud by user" && <button className="btn btn-danger btn-sm" onClick={() => act(t, "fraud")}>Report</button>}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-slate-500">Detection uses category-relative amount spikes, first-time merchants with large amounts, and same-merchant duplicates within 24 hours.</p>
            </>
          );
        }}
      </Async>
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange, suffix }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; suffix: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-indigo-500" aria-label={label} />
    </div>
  );
}

export function FinancialAdvisor() {
  const q = useApi<InsightsPayload>("/api/ai/insights");
  const [cut, setCut] = useState(15);
  const [cat, setCat] = useState("");
  const [sip, setSip] = useState(5000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);
  const r = rate / 100 / 12;
  const n = years * 12;
  const fv = r > 0 ? sip * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) : sip * n;
  return (
    <div className="space-y-6">
      <PageHeader title="Financial Advisor" subtitle="Personalised advice and what-if simulators" icon={Lightbulb} actions={<><AiBadge>Advisor</AiBadge><Link href="/ai" className="btn btn-secondary btn-sm">Ask the assistant</Link></>} />
      <Async q={q} skeleton={<PageSkeleton cards={2} rows={3} />}>
        {(d) => {
          const cats = d.predictions.byCategory;
          const sel = cats.find((c) => c.name === cat) ?? cats[0];
          const saved = sel ? sel.average * (cut / 100) : 0;
          return (
            <>
              <div className="grid gap-4 md:grid-cols-2">{d.advice.map((a) => (
                <Card key={a.id} hover className="flex gap-4">
                  <span className="text-3xl">{a.icon}</span>
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{a.title}</p><Badge tone="violet">{a.impact}</Badge></div><p className="mt-1 text-sm text-slate-500">{a.body}</p></div>
                </Card>
              ))}</div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <SectionTitle title="Savings simulator" sub="What if I spend less on…" />
                  <select className="input mb-4" value={sel?.name ?? ""} onChange={(e) => setCat(e.target.value)} aria-label="Category">{cats.map((c) => <option key={c.name} value={c.name}>{catMeta(c.name).emoji} {c.name} (≈ {money(c.average)}/mo)</option>)}</select>
                  <SliderField label="Reduce by" value={cut} min={0} max={50} step={5} onChange={setCut} suffix="%" />
                  <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl bg-emerald-500/10 p-4"><p className="text-xs text-slate-500">Monthly saving</p><p className="money text-xl font-bold text-emerald-600">{money(saved)}</p></div>
                    <div className="rounded-2xl bg-emerald-500/10 p-4"><p className="text-xs text-slate-500">Yearly saving</p><p className="money text-xl font-bold text-emerald-600">{money(saved * 12)}</p></div>
                  </div>
                </Card>
                <Card>
                  <SectionTitle title="Investment (SIP) calculator" sub="Illustrative returns — not financial advice" />
                  <div className="space-y-4">
                    <SliderField label="Monthly investment" value={sip} min={500} max={50000} step={500} onChange={setSip} suffix={` ${money(0).replace("0", "")}`.trimEnd()} />
                    <SliderField label="Duration" value={years} min={1} max={30} step={1} onChange={setYears} suffix=" yrs" />
                    <SliderField label="Expected return" value={rate} min={4} max={18} step={1} onChange={setRate} suffix="% p.a." />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl bg-slate-100 p-4 dark:bg-white/5"><p className="text-xs text-slate-500">Invested</p><p className="money text-xl font-bold">{money(sip * n)}</p></div>
                    <div className="bg-grad rounded-2xl p-4 text-white"><p className="text-xs opacity-80">Future value</p><p className="money text-xl font-bold">{money(fv)}</p></div>
                  </div>
                  <ProgressBar className="mt-4" value={sip * n} max={fv} warn={false} />
                  <p className="mt-1 text-xs text-slate-500">Estimated gains: {money(fv - sip * n)}</p>
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}
