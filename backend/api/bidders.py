import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.config import settings
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, Bidder, BidderDocument, BidderEvidence,
    DocumentChunk, OCRStatus, OverallVerdict, Tender, User
)
from backend.services import audit_service
from backend.services.ocr_engine import extract_document
from backend.services.extraction_service import extract_evidence_for_criterion

router = APIRouter(prefix="/tenders/{tender_id}/bidders", tags=["bidders"])


class BidderCreate(BaseModel):
    company_name: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    contact_name: Optional[str] = None


class BidderOut(BaseModel):
    bidder_id: str
    tender_id: str
    company_name: str
    gstin: Optional[str]
    pan: Optional[str]
    email: Optional[str]
    contact_name: Optional[str]
    overall_verdict: OverallVerdict
    processing_complete: bool
    submission_timestamp: datetime
    document_count: Optional[int] = 0

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    doc_id: str
    bidder_id: str
    filename: str
    original_filename: Optional[str]
    file_type: Optional[str]
    doc_category: Optional[str]
    ocr_status: OCRStatus
    ocr_confidence: Optional[float]
    page_count: Optional[int]
    upload_time: datetime

    class Config:
        from_attributes = True


class EvidenceOut(BaseModel):
    evidence_id: str
    bidder_id: str
    criterion_id: str
    source_doc_id: Optional[str]
    source_page: Optional[int]
    extracted_text: Optional[str]
    extracted_value: Optional[object]
    unit: Optional[str]
    reference_period: Optional[dict]
    extraction_notes: Optional[str]
    ocr_confidence: Optional[float]
    extraction_confidence: Optional[float]
    extracted_at: datetime

    class Config:
        from_attributes = True


def _save_upload(file: UploadFile, subfolder: str) -> str:
    folder = Path(settings.storage_base_path) / subfolder
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{ext}"
    dest = folder / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return str(dest)


def _process_document_bg(doc_id: str):
    from backend.database import SessionLocal
    MAX_CHUNK_CHARS = 3000
    OVERLAP_CHARS = 400

    db = SessionLocal()
    try:
        doc = db.query(BidderDocument).filter(BidderDocument.doc_id == doc_id).first()
        if not doc:
            return

        doc.ocr_status = OCRStatus.PROCESSING
        db.commit()

        result = extract_document(doc.storage_path)

        for page_data in result["pages"]:
            text = page_data["text"]
            start, idx = 0, 0
            while start < len(text):
                end = min(start + MAX_CHUNK_CHARS, len(text))
                chunk_text = text[start:end].strip()
                if chunk_text:
                    chunk = DocumentChunk(
                        doc_id=doc_id,
                        chunk_text=chunk_text,
                        page_number=page_data["page"],
                        chunk_index=idx,
                        token_count=len(chunk_text.split()),
                        extraction_confidence=page_data.get("confidence", 0.9),
                    )
                    db.add(chunk)
                    idx += 1
                start = end - OVERLAP_CHARS if end < len(text) else end

        doc.ocr_status = OCRStatus.COMPLETE
        doc.ocr_confidence = result["avg_confidence"]
        doc.page_count = result["page_count"]
        doc.extracted_text_preview = result["full_text"][:500] if result["full_text"] else ""
        doc.processed_at = datetime.utcnow()
        db.commit()

        audit_service.log_event(
            db=db,
            event_type=AuditEventType.OCR_COMPLETED,
            actor_id="SYSTEM",
            payload={"doc_id": doc_id, "page_count": result["page_count"], "avg_confidence": result["avg_confidence"]},
            bidder_id=doc.bidder_id,
        )
    except Exception as e:
        try:
            doc = db.query(BidderDocument).filter(BidderDocument.doc_id == doc_id).first()
            if doc:
                doc.ocr_status = OCRStatus.FAILED
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _run_extraction_and_rules_bg(bidder_id: str):
    from backend.database import SessionLocal
    from backend.services.rule_engine import evaluate_bidder
    db = SessionLocal()
    try:
        bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
        if not bidder:
            return
        tender = bidder.tender
        approved_criteria = [c for c in tender.criteria if c.is_approved]
        for criterion in approved_criteria:
            extract_evidence_for_criterion(bidder_id, criterion, db)
        evaluate_bidder(bidder_id, db)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Background pipeline failed for bidder {bidder_id}: {e}")
    finally:
        db.close()


@router.post("/", response_model=BidderOut, status_code=201)
def create_bidder(
    tender_id: str,
    payload: BidderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    bidder = Bidder(
        tender_id=tender_id,
        company_name=payload.company_name,
        gstin=payload.gstin,
        pan=payload.pan,
        email=payload.email,
        contact_name=payload.contact_name,
    )
    db.add(bidder)
    db.commit()
    db.refresh(bidder)
    audit_service.log_event(
        db=db, event_type=AuditEventType.BIDDER_UPLOADED,
        actor_id=current_user.user_id, actor_type="HUMAN",
        payload={"bidder_id": bidder.bidder_id, "company_name": payload.company_name},
        tender_id=tender_id, bidder_id=bidder.bidder_id,
    )
    out = BidderOut.model_validate(bidder)
    out.document_count = 0
    return out


@router.get("/", response_model=List[BidderOut])
def list_bidders(tender_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    results = []
    for b in tender.bidders:
        out = BidderOut.model_validate(b)
        out.document_count = len(b.documents)
        results.append(out)
    return results


@router.get("/{bidder_id}", response_model=BidderOut)
def get_bidder(tender_id: str, bidder_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    out = BidderOut.model_validate(bidder)
    out.document_count = len(bidder.documents)
    return out


@router.post("/{bidder_id}/documents", response_model=DocumentOut, status_code=201)
def upload_document(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    doc_category: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")

    import os
    file_size = 0
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    storage_path = _save_upload(file, f"bidders/{bidder_id}")
    ext = Path(file.filename).suffix.lower()

    doc = BidderDocument(
        bidder_id=bidder_id,
        filename=Path(storage_path).name,
        original_filename=file.filename,
        file_type=ext.lstrip("."),
        doc_category=doc_category,
        storage_path=storage_path,
        file_size_bytes=file_size,
        ocr_status=OCRStatus.PENDING,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(_process_document_bg, doc.doc_id)
    return doc


@router.get("/{bidder_id}/documents", response_model=List[DocumentOut])
def list_documents(tender_id: str, bidder_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    return bidder.documents


@router.post("/{bidder_id}/evaluate", response_model=dict)
def trigger_evaluation(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    background_tasks.add_task(_run_extraction_and_rules_bg, bidder_id)
    return {"status": "evaluation_triggered", "bidder_id": bidder_id}


@router.get("/{bidder_id}/evidence", response_model=List[EvidenceOut])
def get_evidence(tender_id: str, bidder_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    return bidder.evidence_records
