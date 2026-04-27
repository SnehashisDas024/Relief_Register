"""
backend/app/modules/ocr.py — Text extraction from images and PDFs.

Strategy by file type:
  .png / .jpg / .jpeg  → Gemini Vision API (base64 inline image)
  .pdf                 → Try pypdf text extraction first (fast, no poppler).
                         If pypdf yields < 50 chars (scanned PDF), fall back
                         to Gemini Vision on each page rendered with Pillow.

WHY NOT pdf2image / Tesseract:
  • pdf2image requires Poppler — a C binary that cannot be installed on
    Render's managed Python environment and is painful on Windows.
  • Tesseract is similarly a C binary not available on Render.
  • Gemini Vision API is a pure HTTPS call — works everywhere.

Requirements (all pure-Python / API):
  pip install google-generativeai pypdf Pillow
  GEMINI_API_KEY env var must be set.
"""

import io
import os
import base64
from typing import Optional

import google.generativeai as genai

# ── Gemini model singleton ────────────────────────────────────────────────────

_CONFIGURED = False


def _ensure_configured():
    global _CONFIGURED
    if not _CONFIGURED:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY is not set. "
                "Get a free key at https://aistudio.google.com and add it to your .env file."
            )
        genai.configure(api_key=api_key)
        _CONFIGURED = True


def _model():
    _ensure_configured()
    return genai.GenerativeModel("gemini-1.5-flash")


# ── Image extraction ──────────────────────────────────────────────────────────

def extract_text_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Send image bytes to Gemini Vision and return all extracted text.
    Returns "" on any failure so the pipeline can route to dead-letter queue.
    """
    try:
        model = _model()
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        part = {"inline_data": {"mime_type": mime_type, "data": b64}}
        prompt = (
            "Extract ALL text from this image exactly as it appears. "
            "Preserve line breaks and table structure. "
            "If you see a form or table, extract it row by row as: key: value. "
            "Return only the extracted text — no commentary."
        )
        response = model.generate_content([prompt, part])
        return response.text.strip() if response.text else ""
    except Exception as e:
        print(f"[OCR] extract_text_from_image error: {e}")
        return ""


# ── PDF extraction ────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from a PDF.

    Approach 1 — pypdf (pure Python, zero system dependencies):
      Works perfectly for digitally-created PDFs (forms, reports, exports).
      Fails silently (returns very little text) for scanned/image-only PDFs.

    Approach 2 — Gemini Vision fallback for scanned PDFs:
      Renders each page as a JPEG using Pillow's PDF support and sends
      it to Gemini Vision. Works for any PDF including handwritten forms.
      Costs 1 Gemini API call per page.
    """
    # ── Try pypdf first (fast, free, no API calls) ────────────────────
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text() or ""
            pages_text.append(t.strip())
        combined = "\n\n".join(t for t in pages_text if t)
        if len(combined) >= 50:
            return combined   # Good digitally-created PDF — done
        # Fall through to Vision if too little text extracted
    except Exception as e:
        print(f"[OCR] pypdf error (will try Gemini fallback): {e}")

    # ── Gemini Vision fallback for scanned PDFs ───────────────────────
    return _pdf_via_vision(pdf_bytes)


def _pdf_via_vision(pdf_bytes: bytes) -> str:
    """
    Render each PDF page as a JPEG image and run Gemini Vision OCR.
    Uses Pillow — pure Python, no Poppler required.
    Falls back gracefully if the PDF renderer is not available.
    """
    try:
        from PIL import Image
        import struct
        import zlib

        # Pillow cannot render arbitrary PDFs (it only reads raster formats).
        # For scanned PDFs, we send the raw bytes to Gemini as a PDF part.
        # Gemini 1.5 Flash natively supports PDF input via inline_data.
        model = _model()
        b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        part = {"inline_data": {"mime_type": "application/pdf", "data": b64}}
        prompt = (
            "Extract ALL text from every page of this PDF exactly as written. "
            "Preserve tables, forms, and line structure. "
            "Return only the extracted text — no commentary."
        )
        response = model.generate_content([part, prompt])
        return response.text.strip() if response.text else ""
    except Exception as e:
        print(f"[OCR] Gemini PDF fallback error: {e}")
        return ""


# ── Unified dispatcher ────────────────────────────────────────────────────────

def extract_text(file_bytes: bytes, file_ext: str) -> str:
    """
    Dispatch to the correct extraction method based on file extension.

    Args:
        file_bytes: Raw file content as bytes.
        file_ext:   Extension including dot, e.g. '.pdf', '.png', '.jpg'

    Returns:
        Extracted text string. Empty string on failure.
    """
    ext = file_ext.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_bytes)
    mime_map = {
        ".png":  "image/png",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    mime = mime_map.get(ext, "image/jpeg")
    return extract_text_from_image(file_bytes, mime_type=mime)
