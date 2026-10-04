"""
Finance Agent — LangGraph-style pipeline without external graph deps.
Runs: QueryAnalyzer → SQL → Vector → ContextFusion → LLMGenerate
"""
from __future__ import annotations
import os
from dataclasses import dataclass, field


@dataclass
class AgentState:
    query: str
    sql_context: dict | None = None
    vector_context: list = field(default_factory=list)
    context_str: str = ""
    citations: list = field(default_factory=list)
    final_answer: str = ""
    steps: list[str] = field(default_factory=list)


async def _analyze(state: AgentState) -> AgentState:
    from rag.hybrid_search import classify_query
    mode = classify_query(state.query)
    state.steps.append(f"Step 1 — Query classified: {mode}")
    return state


async def _sql_node(state: AgentState) -> AgentState:
    if state.sql_context:
        n = state.sql_context.get("count", 0)
        state.steps.append(f"Step 2 — SQL retrieval: {n} transactions found")
    else:
        state.steps.append("Step 2 — SQL retrieval: skipped")
    return state


async def _vector_node(state: AgentState) -> AgentState:
    n = len(state.vector_context)
    state.steps.append(f"Step 3 — Vector retrieval: {n} chunks from knowledge base")
    return state


async def _fuse(state: AgentState) -> AgentState:
    from rag.context_builder import build_context, build_citations
    state.context_str = build_context(state.sql_context, state.vector_context)
    state.citations = build_citations(state.vector_context, state.sql_context)
    state.steps.append(f"Step 4 — Context fusion: {len(state.citations)} sources merged")
    return state


async def _generate(state: AgentState) -> AgentState:
    key   = os.getenv("GROQ_API_KEY", "")
    model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    if not key:
        state.final_answer = _local_answer(state)
        state.steps.append("Step 5 — Answer: local fallback (no GROQ_API_KEY)")
        return state

    try:
        import httpx, json as _json

        system = (
            "You are an expert AI financial assistant for Krish (Indian user).\n"
            "Answer using ONLY the provided context. Be concise and specific.\n"
            "Use ₹ for currency. Cite document names when referencing receipts."
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": f"Context:\n{state.context_str}\n\nQuestion: {state.query}"},
        ]
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "max_tokens": 1024, "temperature": 0.3},
            )
        if res.status_code == 200:
            state.final_answer = res.json()["choices"][0]["message"]["content"]
            state.steps.append("Step 5 — Answer: Groq LLM response generated")
        else:
            state.final_answer = _local_answer(state)
            state.steps.append(f"Step 5 — Answer: fallback (Groq {res.status_code})")
    except Exception as e:
        state.final_answer = _local_answer(state)
        state.steps.append(f"Step 5 — Answer: fallback ({e})")

    return state


def _local_answer(state: AgentState) -> str:
    parts = []
    s = state.sql_context
    if s:
        cat   = s.get("category", "all").title()
        total = s.get("total", 0)
        count = s.get("count", 0)
        parts.append(f"{cat} spending: ₹{total:,.0f} across {count} transactions.")
        txns = s.get("transactions", [])
        if txns:
            parts.append("Top: " + ", ".join(f"{t['merchant']} ₹{t['amount']:,.0f}" for t in txns[:3]))
    if state.vector_context:
        names = [c.get("filename", "") for c in state.vector_context[:3]]
        parts.append(f"Relevant documents: {', '.join(n for n in names if n)}")
    return "\n".join(parts) if parts else "No relevant data found for your question. Please try rephrasing."


# ── Pipeline runner ───────────────────────────────────────────────────────────
class FinanceGraph:
    """Sequential agent pipeline — mirrors LangGraph StateGraph behaviour."""

    _nodes = [_analyze, _sql_node, _vector_node, _fuse, _generate]

    async def ainvoke(self, init: dict) -> AgentState:
        state = AgentState(
            query=init.get("query", ""),
            sql_context=init.get("sql_context"),
            vector_context=init.get("vector_context", []),
        )
        for node in self._nodes:
            state = await node(state)
        return state


_graph: FinanceGraph | None = None


def get_graph() -> FinanceGraph:
    global _graph
    if _graph is None:
        _graph = FinanceGraph()
    return _graph
