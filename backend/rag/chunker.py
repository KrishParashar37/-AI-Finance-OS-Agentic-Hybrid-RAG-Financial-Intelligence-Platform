"""
Text chunking — splits documents into overlapping chunks for embedding.
"""
from __future__ import annotations
import re


def chunk_text(
    text: str,
    chunk_size: int = 400,
    overlap: int = 80,
    doc_id: str = "",
    doc_type: str = "",
    filename: str = "",
) -> list[dict]:
    """
    Split text into overlapping chunks with metadata.
    Returns list of {chunk_id, text, metadata}.
    """
    # Clean text
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    # Split into sentences first for cleaner boundaries
    sentences = re.split(r"(?<=[.!?])\s+|(?<=\n)\n", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current = ""
    chunk_idx = 0

    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append({
                    "chunk_id": f"{doc_id}_chunk_{chunk_idx}",
                    "text": current,
                    "metadata": {
                        "document_id": doc_id,
                        "doc_type": doc_type,
                        "filename": filename,
                        "chunk_index": chunk_idx,
                        "char_count": len(current),
                    },
                })
                chunk_idx += 1
                # Overlap: keep last `overlap` chars
                current = current[-overlap:] + " " + sent if overlap else sent
                current = current.strip()
            else:
                # Sentence itself is too long — split by words
                words = sent.split()
                while words:
                    batch = []
                    length = 0
                    while words and length + len(words[0]) + 1 <= chunk_size:
                        batch.append(words.pop(0))
                        length += len(batch[-1]) + 1
                    chunk_text_str = " ".join(batch)
                    chunks.append({
                        "chunk_id": f"{doc_id}_chunk_{chunk_idx}",
                        "text": chunk_text_str,
                        "metadata": {
                            "document_id": doc_id,
                            "doc_type": doc_type,
                            "filename": filename,
                            "chunk_index": chunk_idx,
                            "char_count": len(chunk_text_str),
                        },
                    })
                    chunk_idx += 1
                current = ""

    # Last chunk
    if current:
        chunks.append({
            "chunk_id": f"{doc_id}_chunk_{chunk_idx}",
            "text": current,
            "metadata": {
                "document_id": doc_id,
                "doc_type": doc_type,
                "filename": filename,
                "chunk_index": chunk_idx,
                "char_count": len(current),
            },
        })

    return chunks
