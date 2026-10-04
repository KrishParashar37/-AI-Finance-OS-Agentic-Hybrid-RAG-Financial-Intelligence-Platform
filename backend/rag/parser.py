"""
Document parser — extracts raw text from PDF, images, and plain text.
Uses pypdf for PDFs. For images uses pytesseract if available, else metadata.
"""
from __future__ import annotations
import io, re
from pathlib import Path

def parse_pdf(content: bytes) -> str:
    """Extract all text from a PDF byte stream."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        pages = []
        for i, page in enumerate(reader.pages):
            t = page.extract_text() or ""
            if t.strip():
                pages.append(f"[Page {i+1}]\n{t.strip()}")
        return "\n\n".join(pages)
    except Exception as e:
        return f"[PDF parse error: {e}]"


def parse_image(content: bytes, filename: str = "") -> str:
    """Try OCR via pytesseract; fall back to filename-based hint."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(img, lang="eng")
        return text.strip() or f"[Image: {filename} — OCR returned empty]"
    except Exception:
        return f"[Image: {filename} — OCR unavailable. Install Tesseract for full OCR support.]"


def parse_document(content: bytes, filename: str, content_type: str = "") -> str:
    """Route to the correct parser based on file type."""
    lower = filename.lower()
    ct = content_type.lower()

    if "pdf" in ct or lower.endswith(".pdf"):
        return parse_pdf(content)
    if any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".heic")):
        return parse_image(content, filename)
    if any(lower.endswith(ext) for ext in (".txt", ".csv", ".md")):
        return content.decode("utf-8", errors="replace")
    # Try PDF fallback for unknown
    text = parse_pdf(content)
    if not text.startswith("[PDF parse error"):
        return text
    return content.decode("utf-8", errors="replace")
