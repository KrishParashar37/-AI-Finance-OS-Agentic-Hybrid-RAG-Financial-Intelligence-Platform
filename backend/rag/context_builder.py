"""
Context Builder — fuses SQL + vector results into a single LLM prompt context.
Also formats citations for the response.
"""
from __future__ import annotations


def build_context(sql_context: dict | None, vector_context: list[dict]) -> str:
    """Combine SQL and vector retrieval results into a clean context string."""
    parts = []

    if sql_context:
        s = sql_context
        cat_label = s.get("category", "all").title()
        month_label = _month_name(s.get("month"))
        parts.append(
            f"=== SQL RETRIEVAL ({cat_label} | {month_label}) ===\n"
            f"Total spending: ₹{s.get('total', 0):,.0f} across {s.get('count', 0)} transactions.\n"
        )
        txns = s.get("transactions", [])
        if txns:
            parts.append("Recent transactions:")
            for t in txns[:8]:
                parts.append(f"  • {t['date']} — {t['merchant']} ₹{t['amount']:,.0f} [{t['category']}]")

        cat_breakdown = s.get("category_breakdown", [])
        if cat_breakdown:
            parts.append("\nTop categories:")
            for c in cat_breakdown:
                parts.append(f"  • {c['category']}: ₹{c['total']:,.0f}")

    if vector_context:
        parts.append("\n=== DOCUMENT RETRIEVAL (RAG) ===")
        for i, chunk in enumerate(vector_context, 1):
            parts.append(
                f"[Doc {i}] {chunk['filename']} (score: {chunk['score']:.2f})\n"
                f"{chunk['text'][:250]}..."
            )

    return "\n".join(parts)


def build_citations(vector_context: list[dict], sql_context: dict | None) -> list[dict]:
    """Format citation objects for the API response."""
    citations = []

    for chunk in vector_context:
        citations.append({
            "type": "document",
            "title": chunk["filename"] or "Uploaded document",
            "doc_type": chunk["doc_type"],
            "chunk_id": chunk["chunk_id"],
            "score": chunk["score"],
            "preview": chunk["text"][:120] + "…" if len(chunk["text"]) > 120 else chunk["text"],
            "document_id": chunk["document_id"],
        })

    if sql_context:
        month = _month_name(sql_context.get("month"))
        cat   = sql_context.get("category", "All").title()
        citations.append({
            "type": "sql",
            "title": f"MySQL — {cat} transactions ({month})",
            "count": sql_context.get("count", 0),
            "total": sql_context.get("total", 0),
        })

    return citations


def _month_name(month_num: int | None) -> str:
    months = ["", "January","February","March","April","May","June",
              "July","August","September","October","November","December"]
    return months[month_num] if month_num and 1 <= month_num <= 12 else "All time"
