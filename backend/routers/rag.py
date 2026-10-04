"""RAG Router — document upload, indexing, search, query, and stats."""
from __future__ import annotations
import json, time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from deps import ensure_seeded
from models import RagChunk, RagDocument, RagQuery
from rag.ingestion import ingest_document, delete_document
from rag.hybrid_search import hybrid_retrieve
from rag.retriever import retrieve_for_citations
from rag.vector_store import get_store
from agents.graph import get_graph

router = APIRouter(prefix="/api/rag", tags=["rag"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


# ── Upload & index ────────────────────────────────────────────────────────────
@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("receipt"),
    source_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    await ensure_seeded(db)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    ok_ext = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt", ".csv")
    if not any((file.filename or "").lower().endswith(e) for e in ok_ext):
        raise HTTPException(400, f"Unsupported file type. Use: {', '.join(ok_ext)}")
    return await ingest_document(
        db=db, content=content,
        filename=file.filename or "upload",
        content_type=file.content_type or "",
        doc_type=doc_type, source_id=source_id,
    )


# ── List documents ────────────────────────────────────────────────────────────
@router.get("/documents")
async def list_documents(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    res = await db.execute(select(RagDocument).order_by(desc(RagDocument.created_at)))
    return [
        {"id": d.id, "filename": d.filename, "doc_type": d.doc_type,
         "char_count": d.char_count, "chunk_count": d.chunk_count,
         "status": d.status, "createdAt": d.created_at.isoformat()}
        for d in res.scalars().all()
    ]


# ── Single document ───────────────────────────────────────────────────────────
@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    doc = (await db.execute(select(RagDocument).where(RagDocument.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    chunks = (await db.execute(
        select(RagChunk).where(RagChunk.document_id == doc_id).order_by(RagChunk.chunk_index)
    )).scalars().all()
    return {
        "id": doc.id, "filename": doc.filename, "doc_type": doc.doc_type,
        "char_count": doc.char_count, "chunk_count": doc.chunk_count,
        "status": doc.status, "createdAt": doc.created_at.isoformat(),
        "raw_text_preview": doc.raw_text[:500],
        "chunks": [{"id": c.id, "index": c.chunk_index, "text": c.text[:200], "chars": c.char_count} for c in chunks],
    }


# ── Delete document ───────────────────────────────────────────────────────────
@router.delete("/documents/{doc_id}")
async def remove_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    await delete_document(db, doc_id)
    return {"ok": True}


# ── Semantic search ───────────────────────────────────────────────────────────
@router.get("/search")
async def semantic_search(q: str = "", top_k: int = 5):
    if not q.strip():
        return {"results": []}
    results = retrieve_for_citations(q, top_k=top_k)
    return {"query": q, "results": results, "count": len(results)}


# ── Hybrid RAG query ──────────────────────────────────────────────────────────
@router.post("/query")
async def rag_query(body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    query = str(body.get("message", body.get("query", ""))).strip()
    if not query:
        raise HTTPException(400, "query required")
    start = time.monotonic()
    retrieval = await hybrid_retrieve(query, db)
    state = await get_graph().ainvoke({
        "query": query,
        "sql_context": retrieval.get("sql_context"),
        "vector_context": retrieval.get("vector_context", []),
    })
    latency_ms = int((time.monotonic() - start) * 1000)
    log = RagQuery(
        query=query[:500], mode=retrieval["mode"],
        answer=state.final_answer[:1000],
        chunks_retrieved=len(retrieval.get("vector_context", [])),
        sql_used=retrieval.get("sql_context") is not None,
        latency_ms=latency_ms,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return {
        "query": query, "answer": state.final_answer,
        "citations": state.citations, "mode": retrieval["mode"],
        "steps": state.steps, "latency_ms": latency_ms, "query_id": log.id,
    }


# ── Streaming RAG query ───────────────────────────────────────────────────────
@router.post("/query/stream")
async def rag_query_stream(body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    query = str(body.get("message", body.get("query", ""))).strip()
    if not query:
        raise HTTPException(400, "query required")

    async def generate():
        retrieval = await hybrid_retrieve(query, db)
        state = await get_graph().ainvoke({
            "query": query,
            "sql_context": retrieval.get("sql_context"),
            "vector_context": retrieval.get("vector_context", []),
        })
        for i, w in enumerate(state.final_answer.split(" ")):
            yield (json.dumps({"t": "chunk", "v": ("" if i == 0 else " ") + w}) + "\n").encode()
        yield (json.dumps({"t": "citations", "v": state.citations}) + "\n").encode()
        yield (json.dumps({"t": "meta",      "v": {"mode": retrieval["mode"], "steps": state.steps}}) + "\n").encode()
        yield (json.dumps({"t": "done"}) + "\n").encode()

    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ── Re-index all chunks ───────────────────────────────────────────────────────
@router.post("/reindex")
async def reindex_all(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    from rag.embeddings import embed_texts_sync
    chunks = (await db.execute(select(RagChunk))).scalars().all()
    if not chunks:
        return {"ok": True, "reindexed": 0}
    docs = {d.id: d for d in (await db.execute(select(RagDocument))).scalars().all()}
    store = get_store()
    vectors = embed_texts_sync([c.text for c in chunks])
    for chunk, vector in zip(chunks, vectors):
        doc = docs.get(chunk.document_id)
        store.upsert(doc_id=chunk.id, text=chunk.text, vector=vector, metadata={
            "document_id": chunk.document_id, "chunk_index": chunk.chunk_index,
            "filename": doc.filename if doc else "", "doc_type": doc.doc_type if doc else "",
        })
    return {"ok": True, "reindexed": len(chunks)}


# ── Stats dashboard ───────────────────────────────────────────────────────────
@router.get("/stats")
async def rag_stats(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)

    doc_count   = (await db.execute(select(func.count()).select_from(RagDocument))).scalar_one()
    chunk_count = (await db.execute(select(func.count()).select_from(RagChunk))).scalar_one()
    query_count = (await db.execute(select(func.count()).select_from(RagQuery))).scalar_one()
    indexed_cnt = (await db.execute(
        select(func.count()).select_from(RagDocument).where(RagDocument.status == "indexed")
    )).scalar_one()
    avg_latency = round(float(
        (await db.execute(select(func.avg(RagQuery.latency_ms)).select_from(RagQuery))).scalar_one() or 0
    ))

    dtype_rows = (await db.execute(
        select(RagDocument.doc_type, func.count().label("cnt"))
        .group_by(RagDocument.doc_type).order_by(desc("cnt")).limit(8)
    )).all()

    today = datetime.now().date()
    daily_queries = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        ds, de = datetime(day.year, day.month, day.day), datetime(day.year, day.month, day.day) + timedelta(days=1)
        cnt = (await db.execute(
            select(func.count()).select_from(RagQuery)
            .where(RagQuery.created_at >= ds, RagQuery.created_at < de)
        )).scalar_one()
        daily_queries.append({"date": str(day), "count": cnt})

    recent = (await db.execute(
        select(RagQuery).order_by(desc(RagQuery.created_at)).limit(5)
    )).scalars().all()

    return {
        "documents":      doc_count,
        "chunks":         chunk_count,
        "embeddings":     get_store().count,
        "queries":        query_count,
        "vector_db":      "In-Memory (NumPy)",
        "indexed_pct":    round(indexed_cnt / doc_count * 100) if doc_count else 100,
        "avg_latency_ms": avg_latency,
        "cache_hit_rate": 0,
        "top_doc_types":  [{"type": r.doc_type, "count": r.cnt} for r in dtype_rows],
        "daily_queries":  daily_queries,
        "recent_queries": [
            {"id": q.id, "query": q.query[:80], "mode": q.mode,
             "latency_ms": q.latency_ms, "chunks": q.chunks_retrieved,
             "createdAt": q.created_at.isoformat()}
            for q in recent
        ],
    }


# ── Retrieval debug ───────────────────────────────────────────────────────────
@router.get("/retrieval/{query_id}")
async def get_retrieval_debug(query_id: int, db: AsyncSession = Depends(get_db)):
    q = (await db.execute(select(RagQuery).where(RagQuery.id == query_id))).scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Query not found")
    return {
        "query": q.query, "mode": q.mode, "answer": q.answer,
        "latency_ms": q.latency_ms, "sql_used": q.sql_used,
        "chunks_retrieved": q.chunks_retrieved,
        "retrieved_chunks": retrieve_for_citations(q.query, top_k=5),
        "createdAt": q.created_at.isoformat(),
    }
