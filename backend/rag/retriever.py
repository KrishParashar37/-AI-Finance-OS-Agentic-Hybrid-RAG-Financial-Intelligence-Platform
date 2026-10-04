"""
RAG Retriever — semantic search over vector store with reranking.
"""
from __future__ import annotations
from rag.embeddings import embed_texts_sync
from rag.vector_store import get_store


def retrieve(
    query: str,
    top_k: int = 5,
    filter_metadata: dict | None = None,
    min_score: float = 0.05,
) -> list[dict]:
    """
    Embed query → search vector store → return top-k chunks with scores.
    """
    vector = embed_texts_sync([query])[0]
    results = get_store().search(query_vector=vector, top_k=top_k * 2, filter_metadata=filter_metadata)
    # Filter by minimum score
    results = [r for r in results if r["score"] >= min_score]
    # Simple rerank: boost chunks whose text contains exact query words
    qwords = set(query.lower().split())
    for r in results:
        overlap = sum(1 for w in qwords if w in r["text"].lower())
        r["score"] = r["score"] + overlap * 0.02   # small boost
    results.sort(key=lambda x: -x["score"])
    return results[:top_k]


def retrieve_for_citations(query: str, top_k: int = 5) -> list[dict]:
    """Returns chunks formatted for citation display."""
    chunks = retrieve(query, top_k=top_k)
    return [
        {
            "chunk_id": c["id"],
            "text": c["text"][:300],
            "score": round(c["score"], 3),
            "filename": c["metadata"].get("filename", ""),
            "doc_type": c["metadata"].get("doc_type", ""),
            "document_id": c["metadata"].get("document_id", ""),
            "chunk_index": c["metadata"].get("chunk_index", 0),
        }
        for c in chunks
    ]
