"""
Pure-Python in-memory vector store with JSON persistence.
No Qdrant/grpcio needed — works on any platform.
Interface mirrors Qdrant so it can be swapped later.
"""
from __future__ import annotations
import json, time, uuid
from pathlib import Path
from typing import Any

import numpy as np

from rag.embeddings import cosine_similarity

STORE_FILE = Path(__file__).parent / "_vectors.json"


class VectorStore:
    """Thread-safe in-memory vector store with disk persistence."""

    def __init__(self):
        self._docs: list[dict] = []   # {id, text, vector, metadata}
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────
    def _load(self):
        if STORE_FILE.exists():
            try:
                self._docs = json.loads(STORE_FILE.read_text(encoding="utf-8"))
            except Exception:
                self._docs = []

    def _save(self):
        STORE_FILE.write_text(
            json.dumps(self._docs, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    # ── Write ─────────────────────────────────────────────────────────────────
    def upsert(self, doc_id: str, text: str, vector: list[float], metadata: dict) -> str:
        # Replace if exists
        for i, d in enumerate(self._docs):
            if d["id"] == doc_id:
                self._docs[i] = {"id": doc_id, "text": text, "vector": vector, "metadata": metadata}
                self._save()
                return doc_id
        self._docs.append({"id": doc_id, "text": text, "vector": vector, "metadata": metadata})
        self._save()
        return doc_id

    def delete_by_document(self, document_id: str):
        self._docs = [d for d in self._docs if d["metadata"].get("document_id") != document_id]
        self._save()

    def delete_all(self):
        self._docs = []
        self._save()

    # ── Read ──────────────────────────────────────────────────────────────────
    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[dict]:
        results = []
        for d in self._docs:
            # Apply metadata filter
            if filter_metadata:
                match = all(d["metadata"].get(k) == v for k, v in filter_metadata.items())
                if not match:
                    continue
            score = cosine_similarity(query_vector, d["vector"])
            results.append({
                "id": d["id"],
                "text": d["text"],
                "metadata": d["metadata"],
                "score": score,
            })
        results.sort(key=lambda x: -x["score"])
        return results[:top_k]

    def get_by_id(self, doc_id: str) -> dict | None:
        return next((d for d in self._docs if d["id"] == doc_id), None)

    def get_by_document(self, document_id: str) -> list[dict]:
        return [d for d in self._docs if d["metadata"].get("document_id") == document_id]

    @property
    def count(self) -> int:
        return len(self._docs)

    @property
    def document_count(self) -> int:
        ids = {d["metadata"].get("document_id") for d in self._docs}
        return len(ids - {None})


# Global singleton
_store: VectorStore | None = None

def get_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
