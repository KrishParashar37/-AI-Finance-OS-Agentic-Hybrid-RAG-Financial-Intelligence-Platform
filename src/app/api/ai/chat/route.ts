import type { NextRequest } from "next/server";
import { ensureSeeded } from "@/db/seed";
import { answer } from "@/lib/chat";
import { loadContext } from "@/lib/ai";

export const dynamic = "force-dynamic";

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY   = () => process.env.GROQ_API_KEY  ?? "";
const GROQ_MODEL = () => process.env.GROQ_MODEL    ?? "qwen/qwen3.8-27b";

type HistoryMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const body = await req.json() as { message?: string; history?: HistoryMsg[] };
  const message = body.message?.trim() ?? "";
  // history = previous turns sent by the frontend (max last 10)
  const history: HistoryMsg[] = (body.history ?? []).slice(-10);

  if (!message)
    return Response.json({ error: "Message required" }, { status: 400 });

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (obj: unknown) =>
        ctrl.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      try {
        await ensureSeeded();

        const [ctx, localAns] = await Promise.all([
          loadContext(),
          answer(message),
        ]);

        const { txns, budgets, accs, goals, bills, subs } = ctx;

        // ── No key → local answer ─────────────────────────────────────────
        if (!GROQ_KEY()) {
          for (const [i, w] of localAns.text.split(" ").entries()) {
            send({ t: "chunk", v: (i === 0 ? "" : " ") + w });
            await new Promise((r) => setTimeout(r, 18));
          }
          if (localAns.bars?.length) send({ t: "bars", v: localAns.bars });
          send({ t: "done" });
          ctrl.close();
          return;
        }

        // ── System prompt with financial context ──────────────────────────
        const txnLines = txns.slice(-40).map(
          (t) => `${t.date.toISOString().slice(0, 10)} ${t.merchant} ₹${t.amount} [${t.category}]`
        ).join("\n");

        const systemPrompt = `You are a smart, friendly AI financial assistant for Krish (Indian user).
Answer ANY question — finance or general. For finance questions use the data below; for general questions use your knowledge.
Remember the full conversation and give contextually relevant answers — never repeat the same answer if the user asks a follow-up.
Reply in the same language the user writes in (Hindi/English/Hinglish).
Use ₹ for Indian currency. Be concise and conversational.

ACCOUNTS  : ${accs.map((a) => `${a.name} ₹${a.balance}`).join(" | ") || "—"}
BUDGETS   : ${budgets.map((b) => `${b.category} limit ₹${b.limitAmount}`).join(" | ") || "—"}
GOALS     : ${goals.map((g) => `${g.name} ₹${g.saved}/₹${g.target}`).join(" | ") || "—"}
BILLS DUE : ${bills.filter((b) => b.status !== "paid").slice(0, 6).map((b) => `${b.name} ₹${b.amount} ${b.dueDate.toISOString().slice(0, 10)}`).join(" | ") || "—"}
SUBS      : ${subs.filter((s) => s.status === "active").map((s) => `${s.name} ₹${s.amount}/mo`).join(" | ") || "—"}
LAST 40 TXN:
${txnLines}`;

        // ── Build full messages array with history ────────────────────────
        const messages = [
          { role: "system",    content: systemPrompt },
          // inject previous turns so model has full context
          ...history,
          { role: "user",      content: message },
        ];

        // ── Groq streaming ────────────────────────────────────────────────
        const groqRes = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_KEY()}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL(),
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        if (!groqRes.ok || !groqRes.body) {
          console.error("[Groq]", groqRes.status, await groqRes.text().catch(() => ""));
          for (const [i, w] of localAns.text.split(" ").entries()) {
            send({ t: "chunk", v: (i === 0 ? "" : " ") + w });
            await new Promise((r) => setTimeout(r, 18));
          }
          if (localAns.bars?.length) send({ t: "bars", v: localAns.bars });
          send({ t: "done" });
          ctrl.close();
          return;
        }

        const reader = groqRes.body.getReader();
        const dec    = new TextDecoder();
        let buf = "";
        let gotAny = false;

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines2 = buf.split("\n");
          buf = lines2.pop() ?? "";
          for (const line of lines2) {
            const t = line.trim();
            if (!t.startsWith("data: ")) continue;
            const data = t.slice(6).trim();
            if (data === "[DONE]") break outer;
            try {
              const chunk = JSON.parse(data);
              const tok: string = chunk.choices?.[0]?.delta?.content ?? "";
              if (tok) { send({ t: "chunk", v: tok }); gotAny = true; }
            } catch { /* skip malformed */ }
          }
        }

        if (!gotAny) {
          for (const [i, w] of localAns.text.split(" ").entries()) {
            send({ t: "chunk", v: (i === 0 ? "" : " ") + w });
            await new Promise((r) => setTimeout(r, 18));
          }
        }

        if (localAns.bars?.length) send({ t: "bars", v: localAns.bars });
        send({ t: "done" });

      } catch (err) {
        console.error("[ai/chat]", err);
        try {
          const fb = await answer(message);
          for (const [i, w] of fb.text.split(" ").entries()) {
            send({ t: "chunk", v: (i === 0 ? "" : " ") + w });
            await new Promise((r) => setTimeout(r, 18));
          }
          if (fb.bars?.length) send({ t: "bars", v: fb.bars });
        } catch {
          send({ t: "chunk", v: "Kuch gadbad ho gayi, dobara try karein." });
        }
        send({ t: "done" });
      }

      ctrl.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
