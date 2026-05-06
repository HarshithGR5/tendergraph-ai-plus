"""
AI Extraction Engine:
For each criterion, retrieve relevant document chunks and use GPT-4o to extract
the specific value (turnover figure, date, boolean, count, etc.).
"""
import json
import logging
import re
from pathlib import Path
from typing import List, Optional

from jinja2 import Environment, FileSystemLoader
from openai import OpenAI
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models.tables import (
    AuditEventType, Bidder, BidderDocument, BidderEvidence,
    DocumentChunk, TenderCriterion
)
from backend.services import audit_service

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.openai_api_key)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
jinja_env = Environment(loader=FileSystemLoader(str(PROMPT_DIR)))

LAKH = 100_000
CRORE = 10_000_000


def normalise_to_inr(value, unit: str = "INR") -> Optional[float]:
    if value is None:
        return None
    try:
        v = float(value)
        unit_upper = (unit or "INR").upper()
        if "CRORE" in unit_upper or "CR" in unit_upper:
            return v * CRORE
        if "LAKH" in unit_upper or "LAC" in unit_upper:
            return v * LAKH
        if "MILLION" in unit_upper:
            return v * 1_000_000
        if "THOUSAND" in unit_upper:
            return v * 1_000
        return v
    except (TypeError, ValueError):
        return None


def _extract_numeric_from_text(text: str) -> Optional[float]:
    text = text.replace(",", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(crore|lakh|lac|million|thousand|cr\.?)?", text, re.IGNORECASE)
    if not m:
        return None
    num = float(m.group(1))
    unit = (m.group(2) or "").lower()
    if "crore" in unit or unit.startswith("cr"):
        return num * CRORE
    if "lakh" in unit or "lac" in unit:
        return num * LAKH
    if "million" in unit:
        return num * 1_000_000
    if "thousand" in unit:
        return num * 1_000
    return num


def _get_relevant_chunks(bidder_id: str, criterion: TenderCriterion, db: Session, top_k: int = 5) -> List[DocumentChunk]:
    chunks = (
        db.query(DocumentChunk)
        .join(BidderDocument, DocumentChunk.doc_id == BidderDocument.doc_id)
        .filter(BidderDocument.bidder_id == bidder_id)
        .all()
    )
    if not chunks:
        return []
    keywords = criterion.description.lower().split()
    scored = []
    for chunk in chunks:
        chunk_lower = chunk.chunk_text.lower()
        score = sum(1 for kw in keywords if kw in chunk_lower)
        scored.append((score, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def extract_evidence_for_criterion(
    bidder_id: str,
    criterion: TenderCriterion,
    db: Session,
) -> Optional[BidderEvidence]:
    relevant_chunks = _get_relevant_chunks(bidder_id, criterion, db)
    if not relevant_chunks:
        evidence = BidderEvidence(
            bidder_id=bidder_id,
            criterion_id=criterion.criterion_id,
            source_doc_id=None,
            extracted_text=None,
            extracted_value=None,
            unit=None,
            reference_period=None,
            extraction_notes="No document chunks available for this bidder.",
            ocr_confidence=0.0,
            extraction_confidence=0.0,
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        return evidence

    chunks_text = "\n\n---\n\n".join(
        f"[Document: {c.document.filename if c.document else 'unknown'}, Page {c.page_number}]\n{c.chunk_text}"
        for c in relevant_chunks
    )

    template = jinja_env.get_template("evidence_extract.j2")
    prompt = template.render(
        criterion_description=criterion.description,
        criterion_category=criterion.category.value,
        threshold_json=json.dumps(criterion.threshold_json) if criterion.threshold_json else "N/A",
        document_chunks=chunks_text[:6000],
    )

    try:
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
    except Exception as e:
        logger.error(f"Evidence extraction LLM call failed: {e}")
        result = {
            "extracted_text": None,
            "extracted_value": None,
            "unit": None,
            "reference_period": None,
            "source_document_name": None,
            "source_page": None,
            "confidence": 0.0,
            "extraction_notes": f"LLM call failed: {str(e)}",
        }

    source_doc = relevant_chunks[0].document if relevant_chunks else None
    avg_ocr_conf = sum(c.extraction_confidence or 0.9 for c in relevant_chunks) / max(len(relevant_chunks), 1)
    final_conf = min(float(result.get("confidence", 0.0)), avg_ocr_conf)

    evidence = BidderEvidence(
        bidder_id=bidder_id,
        criterion_id=criterion.criterion_id,
        source_doc_id=source_doc.doc_id if source_doc else None,
        source_page=result.get("source_page"),
        extracted_text=result.get("extracted_text"),
        extracted_value=result.get("extracted_value"),
        unit=result.get("unit"),
        reference_period=result.get("reference_period"),
        extraction_notes=result.get("extraction_notes"),
        ocr_confidence=round(avg_ocr_conf, 4),
        extraction_confidence=round(final_conf, 4),
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence
