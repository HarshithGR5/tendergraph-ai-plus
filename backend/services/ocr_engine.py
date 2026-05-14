"""
OCR Engine — multi-format document text extraction.

Pipeline:
  Native PDFs  → PyMuPDF (text layer) + pdfplumber (table extraction → Markdown serialization)
  Scanned PDFs → GPT-4o Vision (high-detail) with structured table extraction prompt
  DOCX         → python-docx paragraph + table walk
  Images       → GPT-4o Vision

Tables from government documents are serialized to GitHub-Flavoured Markdown
(GFM) so they survive chunking and are visible to the LLM extraction stage.
Scanned pages get a dedicated table-aware prompt so financial eligibility tables
(turnover schedules, project lists, EMD schedules) are not silently lost.
"""
import base64
import io
import json
import logging
import os
import re
from pathlib import Path
from typing import List, Optional

import fitz  # PyMuPDF
import pdfplumber
from docx import Document as DocxDocument
from PIL import Image
from openai import OpenAI

from backend.config import settings

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.openai_api_key)


# ── Table serialisation ────────────────────────────────────────────────────────

def _tables_to_markdown(tables: list) -> str:
    """
    Convert pdfplumber raw table arrays (list-of-list-of-str|None) into
    GFM markdown tables so table content is preserved in the text chunks
    sent to the LLM.  Empty or degenerate tables are skipped.
    """
    if not tables:
        return ""
    md_parts = []
    for tbl in tables:
        if not tbl or not isinstance(tbl, list):
            continue
        # Normalise: replace None cells with empty string, strip whitespace
        rows = [
            [str(cell).strip() if cell is not None else "" for cell in row]
            for row in tbl
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        if len(rows) < 1:
            continue
        header = rows[0]
        col_count = len(header)
        if col_count == 0:
            continue
        lines = []
        lines.append("| " + " | ".join(header) + " |")
        lines.append("| " + " | ".join(["---"] * col_count) + " |")
        for row in rows[1:]:
            # Pad short rows, truncate long rows
            padded = (row + [""] * col_count)[:col_count]
            lines.append("| " + " | ".join(padded) + " |")
        md_parts.append("\n".join(lines))
    return "\n\n".join(md_parts)


# ── Image helpers ──────────────────────────────────────────────────────────────

def _image_to_base64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── GPT-4o Vision OCR ─────────────────────────────────────────────────────────

_OCR_TEXT_ONLY_PROMPT = (
    "You are a government-document OCR engine. "
    "Extract ALL text from this page exactly as it appears, preserving "
    "numbers, dates, clause references, and special characters. "
    "Return a JSON object with: "
    "  'text' (full extracted text, string), "
    "  'confidence' (float 0.0-1.0). "
    "Return ONLY the JSON object."
)

_OCR_TABLE_AWARE_PROMPT = (
    "You are a government-document OCR engine specialised in structured procurement forms. "
    "This page likely contains tables (financial schedules, project lists, certificate registers, "
    "EMD details, or eligibility checklists). "
    "Extract ALL content from this page. "
    "For tables, output them in GitHub-Flavoured Markdown table syntax "
    "(pipe-delimited rows with a header separator line). "
    "Preserve every cell value, row, and column header exactly. "
    "For non-table text, output it as plain text. "
    "Return a JSON object with: "
    "  'text' (all non-table prose, string), "
    "  'tables_markdown' (array of GFM table strings, one per table found on the page), "
    "  'confidence' (float 0.0-1.0 indicating overall OCR accuracy). "
    "Return ONLY the JSON object."
)


def _gpt4o_ocr_page(img: Image.Image, page_num: int, table_aware: bool = False) -> dict:
    """
    Use GPT-4o Vision to OCR a page image.

    When table_aware=True (triggered for pages that pdfplumber finds tables on,
    or pages that appear to be structured forms), a specialised prompt is used
    that returns tables in GFM format alongside prose text.
    """
    b64 = _image_to_base64(img)
    prompt = _OCR_TABLE_AWARE_PROMPT if table_aware else _OCR_TEXT_ONLY_PROMPT
    try:
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)

        prose = result.get("text", "")
        tables_md_list = result.get("tables_markdown", [])
        tables_markdown = "\n\n".join(tables_md_list) if tables_md_list else ""

        full_text = prose
        if tables_markdown:
            full_text += "\n\n[TABLE DATA]\n" + tables_markdown

        return {
            "page": page_num,
            "text": full_text,
            "confidence": float(result.get("confidence", 0.7)),
            "method": "gpt4o_vision_table_aware" if table_aware else "gpt4o_vision",
            "tables_found": len(tables_md_list),
        }
    except Exception as e:
        logger.error(f"GPT-4o OCR failed on page {page_num}: {e}")
        return {
            "page": page_num,
            "text": "",
            "confidence": 0.0,
            "method": "gpt4o_vision_failed",
            "tables_found": 0,
        }


def _is_scanned_page(page: fitz.Page, text: str) -> bool:
    """Heuristic: very little extractable text + at least one embedded image → scanned."""
    return len(text.strip()) < 50 and len(page.get_images()) > 0


def _looks_like_table_page(text: str) -> bool:
    """
    Heuristic to detect pages that are likely structured tables even when
    pdfplumber finds no formal table borders (e.g. space-aligned columns).
    """
    lines = [l for l in text.split("\n") if l.strip()]
    if not lines:
        return False
    # More than 30 % of lines contain numeric patterns typical of schedules
    numeric_lines = sum(
        1 for l in lines
        if re.search(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b(?:crore|lakh|lac)\b", l, re.IGNORECASE)
    )
    return (numeric_lines / len(lines)) > 0.30


# ── Per-format extractors ──────────────────────────────────────────────────────

def extract_native_pdf(file_path: str) -> List[dict]:
    """
    Extract text and tables from a native (digitally created) PDF.

    Strategy per page:
      1. PyMuPDF extracts the text layer.
      2. pdfplumber extracts structured tables → serialised to GFM markdown.
      3. Table markdown is appended to the page text so it reaches the LLM.
      4. If the page is scanned (text layer empty + images present), fall back
         to GPT-4o Vision with the table-aware prompt.
      5. If the page has no formal tables but looks like a numeric schedule,
         the table-aware GPT-4o prompt is also used for the fallback path.
    """
    pages = []
    doc = fitz.open(file_path)
    with pdfplumber.open(file_path) as plumber_doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")
            tables = []
            try:
                plumber_page = plumber_doc.pages[page_num - 1]
                raw_tables = plumber_page.extract_tables() or []
                tables = raw_tables
            except Exception:
                pass

            if _is_scanned_page(page, text):
                # Render at 300 dpi for better accuracy on dense government forms
                pix = page.get_pixmap(dpi=300)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                table_aware = bool(tables) or _looks_like_table_page(text)
                ocr_result = _gpt4o_ocr_page(img, page_num, table_aware=table_aware)
                pages.append({
                    "page": page_num,
                    "text": ocr_result["text"],
                    "tables": tables,
                    "confidence": ocr_result["confidence"],
                    "method": ocr_result["method"],
                    "tables_found": ocr_result.get("tables_found", 0),
                })
            else:
                # Serialize extracted tables → GFM and append to text
                table_md = _tables_to_markdown(tables)
                full_page_text = text
                if table_md:
                    full_page_text += "\n\n[TABLE DATA]\n" + table_md

                pages.append({
                    "page": page_num,
                    "text": full_page_text,
                    "tables": tables,
                    "confidence": 0.98,
                    "method": "native_pdf",
                    "tables_found": len(tables),
                })
    doc.close()
    return pages


def extract_docx(file_path: str) -> List[dict]:
    """
    Extract text and tables from a DOCX file.
    Tables are serialised to GFM markdown and appended to the text output.
    """
    doc = DocxDocument(file_path)
    full_text = []

    for para in doc.paragraphs:
        if para.text.strip():
            full_text.append(para.text)

    table_mds = []
    for table in doc.tables:
        rows = []
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            rows.append(cells)
        if rows:
            table_md = _tables_to_markdown([rows])
            if table_md:
                table_mds.append(table_md)

    combined = "\n".join(full_text)
    if table_mds:
        combined += "\n\n[TABLE DATA]\n" + "\n\n".join(table_mds)

    return [{"page": 1, "text": combined, "tables": [], "confidence": 0.99, "method": "docx_parse", "tables_found": len(table_mds)}]


def extract_image(file_path: str) -> List[dict]:
    """Extract text (and tables) from a standalone image via GPT-4o Vision."""
    img = Image.open(file_path).convert("RGB")
    result = _gpt4o_ocr_page(img, 1, table_aware=True)
    return [{
        "page": 1,
        "text": result["text"],
        "tables": [],
        "confidence": result["confidence"],
        "method": result["method"],
        "tables_found": result.get("tables_found", 0),
    }]


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_document(file_path: str) -> dict:
    """
    Entry point for the document extraction pipeline.

    Returns:
        pages        : list of per-page dicts (text, tables, confidence, method)
        full_text    : concatenated text from all pages (includes GFM table data)
        page_count   : int
        avg_confidence: float
        primary_method: str
        total_tables_found: int
    """
    ext = Path(file_path).suffix.lower()
    try:
        if ext == ".pdf":
            pages = extract_native_pdf(file_path)
        elif ext in (".docx", ".doc"):
            pages = extract_docx(file_path)
        elif ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"):
            pages = extract_image(file_path)
        else:
            logger.warning(f"Unsupported file type: {ext}")
            pages = [{"page": 1, "text": "", "tables": [], "confidence": 0.0, "method": "unsupported", "tables_found": 0}]

        all_text = "\n\n".join(p["text"] for p in pages if p["text"])
        avg_confidence = sum(p["confidence"] for p in pages) / max(len(pages), 1)
        total_tables = sum(p.get("tables_found", 0) for p in pages)

        return {
            "pages": pages,
            "full_text": all_text,
            "page_count": len(pages),
            "avg_confidence": round(avg_confidence, 4),
            "primary_method": pages[0]["method"] if pages else "none",
            "total_tables_found": total_tables,
        }
    except Exception as e:
        logger.error(f"Document extraction failed for {file_path}: {e}")
        return {
            "pages": [],
            "full_text": "",
            "page_count": 0,
            "avg_confidence": 0.0,
            "primary_method": "failed",
            "total_tables_found": 0,
            "error": str(e),
        }
