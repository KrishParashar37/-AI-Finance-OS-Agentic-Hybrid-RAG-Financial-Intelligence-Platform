"""
RAG Ingestion Pipeline:
  File → Parse → Chunk → Embed → Vector Store + MySQL
"""
from __future__ import annotations
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import RagDocument, RagChunk
from rag.parser import parse_document
from rag.chunker import chunk_text
from rag.embeddings import embed_texts_sync
from rag.vector_store import get_store


async def ingest_document(
    db: AsyncSession,
    content: bytes,
    filename: str,
    content_type: str,
    doc_type: str = "receipt",
    source_id: int | None = None,   # scan.id or transaction.id
) -> dict:
    """
    Full pipeline: bytes → parsed text → chunks → embeddings → stored.
    Returns summary dict.
    """
    # 1. Parse
    raw_text = parse_document(content, filename, content_type)
    char_count = len(raw_text)

    # 2. Save document record to MySQL
    doc_id = str(uuid.uuid4())
    doc = RagDocument(
        id=doc_id,
        filename=filename,
        doc_type=doc_type,
        source_id=source_id,
        raw_text=raw_text[:65535],   # TEXT column limit
        char_count=char_count,
        status="processing",
    )
    db.add(doc)
    await db.flush()

    # 3. Chunk
    chunks = chunk_text(
        raw_text,
        chunk_size=400,
        overlap=80,
        doc_id=doc_id,
        doc_type=doc_type,
        filename=filename,
    )

    # 4. Embed (batch)
    texts = [c["text"] for c in chunks]
    vectors = embed_texts_sync(texts)

    # 5. Store chunks in MySQL + vector store
    store = get_store()
    for chunk, vector in zip(chunks, vectors):
        db_chunk = RagChunk(
            id=chunk["chunk_id"],
            document_id=doc_id,
            chunk_index=chunk["metadata"]["chunk_index"],
            text=chunk["text"],
            char_count=chunk["metadata"]["char_count"],
        )
        db.add(db_chunk)
        store.upsert(
            doc_id=chunk["chunk_id"],
            text=chunk["text"],
            vector=vector,
            metadata={
                **chunk["metadata"],
                "document_id": doc_id,
                "filename": filename,
                "doc_type": doc_type,
                "source_id": source_id,
            },
        )

    # 6. Mark done
    doc.status = "indexed"
    doc.chunk_count = len(chunks)
    await db.commit()

    return {
        "document_id": doc_id,
        "filename": filename,
        "doc_type": doc_type,
        "char_count": char_count,
        "chunks": len(chunks),
        "status": "indexed",
    }


async def delete_document(db: AsyncSession, document_id: str):
    """Remove document from MySQL + vector store."""
    res = await db.execute(select(RagDocument).where(RagDocument.id == document_id))
    doc = res.scalar_one_or_none()
    if doc:
        await db.delete(doc)
    # Chunks cascade via FK, but also remove from vector store
    get_store().delete_by_document(document_id)
    await db.commit()
