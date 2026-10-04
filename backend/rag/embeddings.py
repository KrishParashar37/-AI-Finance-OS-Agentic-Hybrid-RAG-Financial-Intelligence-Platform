"""
Embeddings via Groq API (free, no torch needed).
Falls back to a simple TF-IDF-style bag-of-words if Groq key unavailable.
"""
from __future__ import annotations
import hashlib, json, math, os, re
from collections import Counter
from pathlib import Path

import httpx
import numpy as np

GROQ_KEY   = lambda: os.getenv("GROQ_API_KEY", "")
EMBED_DIM  = 384          # we project to this for consistency

# ── Simple deterministic fallback embedding (no external deps) ───────────────
_VOCAB_CACHE: dict[str, int] = {}
_VOCAB_FILE  = Path(__file__).parent / "_vocab.json"

def _load_vocab() -> dict[str, int]:
    if _VOCAB_CACHE:
        return _VOCAB_CACHE
    if _VOCAB_FILE.exists():
        _VOCAB_CACHE.update(json.loads(_VOCAB_FILE.read_text()))
    return _VOCAB_CACHE

def _save_vocab():
    _VOCAB_FILE.write_text(json.dumps(_VOCAB_CACHE))

def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z₹\d]+", text.lower())

def _fallback_embed(text: str) -> list[float]:
    """Deterministic hash-based embedding — no external model needed."""
    vocab = _load_vocab()
    tokens = _tokenize(text)
    counts = Counter(tokens)
    vec = np.zeros(EMBED_DIM, dtype=np.float32)
    for tok, cnt in counts.items():
        if tok not in vocab:
            # assign a stable slot based on hash
            slot = int(hashlib.md5(tok.encode()).hexdigest(), 16) % EMBED_DIM
            vocab[tok] = slot
        vec[vocab[tok]] += cnt * (1 + math.log(1 + cnt))
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    # Only save vocab periodically to avoid slow writes
    if len(vocab) % 50 == 0:
        _save_vocab()
    return vec.tolist()


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Returns embeddings for a list of texts.
    Uses Groq /openai/v1/embeddings if key present, else fallback.
    NOTE: Groq doesn't currently expose an embeddings endpoint for all models,
    so we use the fallback by default and only try Groq if it ever adds one.
    """
    return [_fallback_embed(t) for t in texts]


def embed_texts_sync(texts: list[str]) -> list[list[float]]:
    return [_fallback_embed(t) for t in texts]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0
