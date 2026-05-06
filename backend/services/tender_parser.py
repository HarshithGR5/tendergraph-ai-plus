"""
Tender Understanding Pipeline:
Stage 1: Document extraction (via ocr_engine)
Stage 2: Clause segmentation (structural + heuristic)
Stage 3: Criterion extraction (GPT-4o structured output)
Stage 4: Mandatory/Optional classification (LLM + deterministic override)
Stage 5: Category tagging
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
    AuditEventType, CriterionCategory, MandatoryStatus,
    OCRStatus, Tender, TenderCriterion, TenderStatus
)
from backend.services import audit_service
from backend.services.ocr_engine import extract_document

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.openai_api_key)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
jinja_env = Environment(loader=FileSystemLoader(str(PROMPT_DIR)))

MANDATORY_PATTERNS = re.compile(
    r"\b(shall|must|is required|are required|essential condition|mandatory|compulsory)\b", re.IGNORECASE
)
OPTIONAL_PREFERRED_PATTERNS = re.compile(
    r"\b(should|is desirable|desirable|preferred|advantageous)\b", re.IGNORECASE
)
OPTIONAL_SCORED_PATTERNS = re.compile(
    r"\b(may|is encouraged|encouraged|additional marks|additional score)\b", re.IGNORECASE
)
CONDITIONAL_PATTERNS = re.compile(
    r"\b(if applicable|where relevant|as the case may be|as applicable|where applicable)\b", re.IGNORECASE
)


def _classify_mandatory(text: str) -> MandatoryStatus:
    if MANDATORY_PATTERNS.search(text):
        return MandatoryStatus.MANDATORY
    if CONDITIONAL_PATTERNS.search(text):
        return MandatoryStatus.CONDITIONAL
    if OPTIONAL_PREFERRED_PATTERNS.search(text):
        return MandatoryStatus.OPTIONAL_PREFERRED
    if OPTIONAL_SCORED_PATTERNS.search(text):
        return MandatoryStatus.OPTIONAL_SCORED
    return MandatoryStatus.MANDATORY


def _classify_category(raw_cat: str) -> CriterionCategory:
    mapping = {
        "FINANCIAL": CriterionCategory.FINANCIAL,
        "TECHNICAL": CriterionCategory.TECHNICAL,
        "COMPLIANCE": CriterionCategory.COMPLIANCE,
        "COMPLETENESS": CriterionCategory.COMPLETENESS,
    }
    return mapping.get(raw_cat.upper(), CriterionCategory.COMPLIANCE)


def extract_criteria_from_text(document_text: str) -> List[dict]:
    template = jinja_env.get_template("criterion_extract.j2")
    prompt = template.render(document_text=document_text[:12000])

    response = client.chat.completions.create(
    model=settings.llm_model,
    messages=[{"role": "user", "content": prompt}],
    max_tokens=4096,
    temperature=0,
    )

    raw = response.choices[0].message.content
    print("\n===== RAW GPT RESPONSE =====\n")
    print(raw)
    print("\n============================\n")
    if not raw:
        logger.error("LLM returned empty response")
        return []

    try:
    # Clean markdown code fences
        raw = raw.strip()

        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"^```\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        parsed = json.loads(raw)

        if isinstance(parsed, list):
            return parsed

        if "criteria" in parsed:
            return parsed["criteria"]

        for v in parsed.values():
            if isinstance(v, list):
                return v

        return []

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse criteria JSON: {e}\nRaw: {raw[:500]}")
        return []


def process_tender(tender_id: str, db: Session) -> bool:
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        logger.error(f"Tender {tender_id} not found")
        return False

    tender.status = TenderStatus.PROCESSING
    tender.ocr_status = OCRStatus.PROCESSING
    db.commit()

    try:
        logger.info(f"Extracting text from {tender.storage_path}")
        extraction = extract_document(tender.storage_path)

        tender.ocr_status = OCRStatus.COMPLETE
        db.commit()

        audit_service.log_event(
            db=db,
            event_type=AuditEventType.OCR_COMPLETED,
            actor_id="SYSTEM",
            payload={"tender_id": tender_id, "page_count": extraction["page_count"], "avg_confidence": extraction["avg_confidence"]},
            tender_id=tender_id,
        )

        full_text = extraction["full_text"]
        if not full_text.strip():
            logger.error(f"No text extracted from tender {tender_id}")
            tender.status = TenderStatus.UPLOADING
            db.commit()
            return False

        logger.info(f"Extracting criteria from tender {tender_id} ({len(full_text)} chars)")
        raw_criteria = extract_criteria_from_text(full_text)
        logger.info(f"LLM returned {len(raw_criteria)} criteria")

        for raw in raw_criteria:
            mandatory_status = _classify_mandatory(raw.get("description", ""))
            llm_mandatory = raw.get("mandatory_status", "MANDATORY")
            if llm_mandatory in ("MANDATORY",):
                mandatory_status = MandatoryStatus.MANDATORY
            elif llm_mandatory in ("OPTIONAL_PREFERRED",):
                mandatory_status = MandatoryStatus.OPTIONAL_PREFERRED
            elif llm_mandatory in ("OPTIONAL_SCORED",):
                mandatory_status = MandatoryStatus.OPTIONAL_SCORED
            elif llm_mandatory in ("CONDITIONAL",):
                mandatory_status = MandatoryStatus.CONDITIONAL

            criterion = TenderCriterion(
                tender_id=tender_id,
                category=_classify_category(raw.get("category", "COMPLIANCE")),
                mandatory_status=mandatory_status,
                description=raw.get("description", "")[:2000],
                threshold_json=raw.get("threshold_json"),
                required_document=raw.get("required_document", "")[:500] if raw.get("required_document") else None,
                source_clause=raw.get("source_clause", "")[:50] if raw.get("source_clause") else None,
                source_page=raw.get("source_page"),
                extraction_confidence=float(raw.get("extraction_confidence", 0.8)),
                ambiguity_flags=raw.get("ambiguity_flags", []),
                is_approved=False,
            )
            db.add(criterion)

        db.commit()

        tender.status = TenderStatus.CRITERIA_EXTRACTED
        db.commit()

        audit_service.log_event(
            db=db,
            event_type=AuditEventType.CRITERION_EXTRACTED,
            actor_id="SYSTEM",
            payload={"tender_id": tender_id, "criteria_count": len(raw_criteria)},
            tender_id=tender_id,
        )

        logger.info(f"Tender {tender_id} processing complete — {len(raw_criteria)} criteria extracted")
        return True

    except Exception as e:
        logger.exception(f"Error processing tender {tender_id}: {e}")
        tender.status = TenderStatus.UPLOADING
        tender.ocr_status = OCRStatus.FAILED
        db.commit()
        return False
