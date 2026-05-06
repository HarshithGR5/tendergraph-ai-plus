"""
OCR Engine — multi-format document text extraction.
Primary path: PyMuPDF + pdfplumber for native PDFs, python-docx for DOCX.
Fallback for scanned/image PDFs: GPT-4o Vision API.
"""
import base64
import io
import json
import logging
import os
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


def _image_to_base64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _gpt4o_ocr_page(img: Image.Image, page_num: int) -> dict:
    """Use GPT-4o Vision to OCR a page image — returns text and confidence."""
    b64 = _image_to_base64(img)
    try:
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "You are an OCR engine for government documents. "
                                "Extract ALL text from this document image exactly as it appears, "
                                "preserving layout, numbers, dates, and special characters. "
                                "Return a JSON object with two fields: "
                                "'text' (the full extracted text) and "
                                "'confidence' (a float 0.0-1.0 indicating your confidence in accuracy). "
                                "Return ONLY the JSON object."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"},
                        },
                    ],
                }
            ],
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "page": page_num,
            "text": result.get("text", ""),
            "confidence": float(result.get("confidence", 0.7)),
            "method": "gpt4o_vision",
        }
    except Exception as e:
        logger.error(f"GPT-4o OCR failed on page {page_num}: {e}")
        return {"page": page_num, "text": "", "confidence": 0.0, "method": "gpt4o_vision_failed"}


def _is_scanned_page(page: fitz.Page, text: str) -> bool:
    return len(text.strip()) < 50 and len(page.get_images()) > 0


def extract_native_pdf(file_path: str) -> List[dict]:
    pages = []
    doc = fitz.open(file_path)
    with pdfplumber.open(file_path) as plumber_doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")
            tables = []
            try:
                plumber_page = plumber_doc.pages[page_num - 1]
                raw_tables = plumber_page.extract_tables()
                for tbl in (raw_tables or []):
                    tables.append(tbl)
            except Exception:
                pass

            if _is_scanned_page(page, text):
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ocr_result = _gpt4o_ocr_page(img, page_num)
                pages.append({
                    "page": page_num,
                    "text": ocr_result["text"],
                    "tables": tables,
                    "confidence": ocr_result["confidence"],
                    "method": "gpt4o_vision",
                })
            else:
                pages.append({
                    "page": page_num,
                    "text": text,
                    "tables": tables,
                    "confidence": 0.98,
                    "method": "native_pdf",
                })
    doc.close()
    return pages


def extract_docx(file_path: str) -> List[dict]:
    doc = DocxDocument(file_path)
    full_text = []
    for para in doc.paragraphs:
        if para.text.strip():
            full_text.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                full_text.append(row_text)
    combined = "\n".join(full_text)
    return [{"page": 1, "text": combined, "tables": [], "confidence": 0.99, "method": "docx_parse"}]


def extract_image(file_path: str) -> List[dict]:
    img = Image.open(file_path).convert("RGB")
    result = _gpt4o_ocr_page(img, 1)
    return [{"page": 1, "text": result["text"], "tables": [], "confidence": result["confidence"], "method": "gpt4o_vision"}]


def extract_document(file_path: str) -> dict:
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
            pages = [{"page": 1, "text": "", "tables": [], "confidence": 0.0, "method": "unsupported"}]

        all_text = "\n\n".join(p["text"] for p in pages if p["text"])
        avg_confidence = sum(p["confidence"] for p in pages) / max(len(pages), 1)
        return {
            "pages": pages,
            "full_text": all_text,
            "page_count": len(pages),
            "avg_confidence": round(avg_confidence, 4),
            "primary_method": pages[0]["method"] if pages else "none",
        }
    except Exception as e:
        logger.error(f"Document extraction failed for {file_path}: {e}")
        return {
            "pages": [],
            "full_text": "",
            "page_count": 0,
            "avg_confidence": 0.0,
            "primary_method": "failed",
            "error": str(e),
        }
