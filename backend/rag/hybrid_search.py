"""
Hybrid Search — routes query to SQL, vector search, or both.
SQL  → exact structured questions  (amounts, dates, counts)
RAG  → semantic/document questions (receipts, descriptions)
Both → complex financial analysis
"""
from __future__ import annotations
import re
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc

from models import Transaction
from rag.retriever import retrieve_for_citations


# ── Query router ─────────────────────────────────────────────────────────────
def classify_query(query: str) -> str:
    """Returns 'sql', 'vector', or 'hybrid'."""
    q = query.lower()

    sql_signals = [
        r"\btotal\b", r"\bsum\b", r"\bhow much\b", r"\bcount\b",
        r"\baverage\b", r"\blast \d+", r"\boctober\b", r"\bjanuary\b",
        r"\bfebruary\b", r"\bmarch\b", r"\bapril\b", r"\bmay\b",
        r"\bjune\b", r"\bjuly\b", r"\baugust\b", r"\bseptember\b",
        r"\bnovember\b", r"\bdecember\b",
        r"\bthis month\b", r"\blast month\b", r"\bthis year\b",
        r"₹", r"\brupee", r"\binr\b",
    ]
    vector_signals = [
        r"\breceipt\b", r"\binvoice\b", r"\bdocument\b", r"\bpdf\b",
        r"\bsimilar\b", r"\blike\b", r"\brelated\b", r"\bfind\b",
        r"\bsearch\b", r"\bshow me\b", r"\bunnecessar\b", r"\bwaste\b",
        r"\belectronic\b", r"\bgadget\b", r"\bsubscription\b",
    ]

    sql_score   = sum(1 for p in sql_signals if re.search(p, q))
    vector_score = sum(1 for p in vector_signals if re.search(p, q))

    if sql_score > 0 and vector_score > 0:
        return "hybrid"
    if vector_score > sql_score:
        return "vector"
    return "sql"     # default to SQL for financial queries


# ── SQL retrieval ─────────────────────────────────────────────────────────────
async def sql_retrieve(query: str, db: AsyncSession) -> dict:
    """Run relevant SQL queries based on the question."""
    q = query.lower()
    results: dict = {}

    # Detect category filter
    CATS = ["food","shopping","transport","groceries","entertainment",
            "health","education","travel","bills","subscriptions","salary"]
    cat = next((c for c in CATS if c in q), None)

    # Detect month
    MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
              "july":7,"august":8,"september":9,"october":10,"november":11,"december":12}
    month_num = next((v for k, v in MONTHS.items() if k in q), None)
    year = datetime.now().year

    # Build base query
    conds = [Transaction.type == "expense"]
    if cat:
        conds.append(Transaction.category.ilike(f"%{cat}%"))
    if month_num:
        conds.append(func.month(Transaction.date) == month_num)
        conds.append(func.year(Transaction.date) == year)

    # Total spending
    total_res = await db.execute(
        select(func.sum(Transaction.amount), func.count(Transaction.id))
        .where(and_(*conds))
    )
    total_amount, count = total_res.one()
    results["total"] = float(total_amount or 0)
    results["count"] = int(count or 0)
    results["category"] = cat or "all"
    results["month"] = month_num
    results["year"] = year

    # Recent transactions
    recent_res = await db.execute(
        select(Transaction)
        .where(and_(*conds))
        .order_by(desc(Transaction.date))
        .limit(10)
    )
    recent = recent_res.scalars().all()
    results["transactions"] = [
        {
            "id": t.id, "merchant": t.merchant, "amount": t.amount,
            "date": t.date.strftime("%d %b %Y"), "category": t.category,
        }
        for t in recent
    ]

    # Category breakdown (top 5)
    cat_res = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(Transaction.type == "expense")
        .group_by(Transaction.category)
        .order_by(desc("total"))
        .limit(5)
    )
    results["category_breakdown"] = [
        {"category": r.category, "total": float(r.total)} for r in cat_res
    ]

    return results


# ── Main hybrid search ────────────────────────────────────────────────────────
async def hybrid_retrieve(query: str, db: AsyncSession) -> dict:
    """
    Routes to SQL, vector, or both — fuses context for the LLM.
    """
    mode = classify_query(query)
    output = {"mode": mode, "sql_context": None, "vector_context": []}

    if mode in ("sql", "hybrid"):
        output["sql_context"] = await sql_retrieve(query, db)

    if mode in ("vector", "hybrid"):
        output["vector_context"] = retrieve_for_citations(query, top_k=5)

    return output
