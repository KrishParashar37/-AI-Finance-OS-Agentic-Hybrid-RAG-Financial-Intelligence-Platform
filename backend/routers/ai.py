"""AI router — insights + streaming chat."""
from __future__ import annotations
import json
import os
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from deps import ensure_seeded
from models import Account, Bill, Budget, Goal, Subscription, Transaction
from ai_engine import get_insights
from chat import answer
from schemas import ChatRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_KEY   = lambda: os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = lambda: os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


@router.get("/insights")
async def insights(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    txns  = (await db.execute(select(Transaction))).scalars().all()
    buds  = (await db.execute(select(Budget))).scalars().all()
    subs  = (await db.execute(select(Subscription))).scalars().all()
    bills = (await db.execute(select(Bill))).scalars().all()
    goals = (await db.execute(select(Goal))).scalars().all()
    accs  = (await db.execute(select(Account))).scalars().all()
    return get_insights(txns, buds, subs, bills, goals, accs)


@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(400, "Message required")

    txns  = (await db.execute(select(Transaction))).scalars().all()
    buds  = (await db.execute(select(Budget))).scalars().all()
    subs  = (await db.execute(select(Subscription))).scalars().all()
    bills = (await db.execute(select(Bill))).scalars().all()
    goals = (await db.execute(select(Goal))).scalars().all()
    accs  = (await db.execute(select(Account))).scalars().all()

    local_ans = answer(message, txns, buds, subs, bills, goals, accs)

    async def stream_local() -> AsyncIterator[bytes]:
        words = local_ans["text"].split(" ")
        for i, w in enumerate(words):
            chunk = ("" if i == 0 else " ") + w
            yield (json.dumps({"t": "chunk", "v": chunk}) + "\n").encode()
        if local_ans.get("bars"):
            yield (json.dumps({"t": "bars", "v": local_ans["bars"]}) + "\n").encode()
        yield (json.dumps({"t": "done"}) + "\n").encode()

    async def stream_groq() -> AsyncIterator[bytes]:
        lines = (txns[-40:])
        ctx_lines = "\n".join(f"{t.date.date()} {t.merchant} ₹{t.amount} [{t.category}]" for t in lines)
        system_prompt = f"""You are a smart, friendly AI financial assistant for Krish (Indian user).
Answer ANY question — finance or general — like ChatGPT. Never say you don't know.
For finance questions use the data below. For general questions use your own knowledge.
Reply in the same language the user writes in (Hindi/English/Hinglish).
Use ₹ for currency. Keep it conversational and concise.

ACCOUNTS  : {" | ".join(f"{a.name} ₹{a.balance:,.0f}" for a in accs) or "—"}
BUDGETS   : {" | ".join(f"{b.category} limit ₹{b.limit_amount:,.0f}" for b in buds) or "—"}
GOALS     : {" | ".join(f"{g.name} ₹{g.saved:,.0f}/₹{g.target:,.0f}" for g in goals) or "—"}
BILLS DUE : {" | ".join(f"{b.name} ₹{b.amount:,.0f} {b.due_date.date()}" for b in bills if b.status != "paid")[:300] or "—"}
SUBS      : {" | ".join(f"{s.name} ₹{s.amount:,.0f}/mo" for s in subs if s.status == "active") or "—"}
LAST 40 TXN:
{ctx_lines}"""

        got_any = False
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                async with client.stream(
                    "POST", GROQ_URL,
                    headers={"Authorization": f"Bearer {GROQ_KEY()}", "Content-Type": "application/json"},
                    json={"model": GROQ_MODEL(), "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": message}], "stream": True, "temperature": 0.7, "max_tokens": 1024},
                ) as resp:
                    if resp.status_code != 200:
                        async for chunk in stream_local():
                            yield chunk
                        return
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data)
                            tok: str = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if tok:
                                yield (json.dumps({"t": "chunk", "v": tok}) + "\n").encode()
                                got_any = True
                        except Exception:
                            pass
        except Exception:
            got_any = False

        if not got_any:
            async for chunk in stream_local():
                yield chunk
            return

        if local_ans.get("bars"):
            yield (json.dumps({"t": "bars", "v": local_ans["bars"]}) + "\n").encode()
        yield (json.dumps({"t": "done"}) + "\n").encode()

    gen = stream_groq() if GROQ_KEY() else stream_local()
    return StreamingResponse(gen, media_type="application/x-ndjson")
