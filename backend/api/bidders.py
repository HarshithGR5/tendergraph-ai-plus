import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role
from backend.config import settings
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, Bidder, BidderDocument, BidderEvidence,
    DocumentChunk, OCRStatus, OverallVerdict, Tender, User, UserRole
)
from backend.services import audit_service
from backend.services.ocr_engine import extract_document
from backend.services.extraction_service import extract_evidence_for_criterion

router = APIRouter(prefix="/tenders/{tender_id}/bidders", tags=["bidders"])

EVALUATION_ROLES = (UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)


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
    submission_confirmed: bool = False
    kyc_status: Optional[str] = None
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


def _run_kyc_for_bidder(bidder: Bidder, db) -> str:
    """Run full KYC for a bidder and persist result. Returns overall KYC status string."""
    try:
        from backend.services.kyc_service import run_full_kyc
        result = run_full_kyc(
            company_name=bidder.company_name,
            gstin=bidder.gstin,
            pan=bidder.pan,
            sandbox=True,
        )
        status = result.get("overall_kyc_status", "REVIEW")
        bidder.kyc_status = status
        bidder.kyc_run_at = datetime.utcnow()
        db.flush()
        audit_service.log_event(
            db=db,
            event_type=AuditEventType.KYC_COMPLETED,
            actor_id="SYSTEM",
            payload={
                "bidder_id": bidder.bidder_id,
                "kyc_status": status,
                "sandbox_mode": result.get("sandbox_mode", True),
                "issues": result.get("issues", []),
            },
            tender_id=bidder.tender_id,
            bidder_id=bidder.bidder_id,
        )
        return status
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"KYC run failed for bidder {bidder.bidder_id}: {e}")
        return "REVIEW"


def _run_extraction_and_rules_bg(bidder_id: str):
    from backend.database import SessionLocal
    from backend.services.rule_engine import evaluate_bidder
    db = SessionLocal()
    try:
        bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
        if not bidder:
            return
        # Auto-run KYC before evaluation if not yet done
        if not bidder.kyc_status:
            _run_kyc_for_bidder(bidder, db)
            db.commit()

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


# ── Bidder self-registration: BIDDER role users only ──────────────────────────
@router.post("/self-register", response_model=BidderOut, status_code=201)
def self_register_bidder(
    tender_id: str,
    payload: BidderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """Bidder self-registers to a tender after reviewing the open tender list."""
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    existing = db.query(Bidder).filter(
        Bidder.tender_id == tender_id,
        Bidder.user_id == current_user.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already registered for this tender.")

    bidder = Bidder(
        tender_id=tender_id,
        user_id=current_user.user_id,
        company_name=payload.company_name,
        gstin=payload.gstin,
        pan=payload.pan,
        email=payload.email or current_user.email,
        contact_name=payload.contact_name or current_user.full_name,
    )
    db.add(bidder)
    db.commit()
    db.refresh(bidder)
    audit_service.log_event(
        db=db, event_type=AuditEventType.BIDDER_REGISTERED,
        actor_id=current_user.user_id, actor_type="HUMAN",
        payload={"bidder_id": bidder.bidder_id, "company_name": payload.company_name, "tender_id": tender_id},
        tender_id=tender_id, bidder_id=bidder.bidder_id,
    )
    out = BidderOut.model_validate(bidder)
    out.document_count = 0
    return out


# ── Bidder: get own profile ────────────────────────────────────────────────────
@router.get("/my-registration", response_model=BidderOut)
def get_my_registration(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    bidder = db.query(Bidder).filter(
        Bidder.tender_id == tender_id,
        Bidder.user_id == current_user.user_id
    ).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="You are not registered for this tender.")
    out = BidderOut.model_validate(bidder)
    out.document_count = len(bidder.documents)
    return out


# ── List bidders: internal staff only ─────────────────────────────────────────
@router.get("/", response_model=List[BidderOut])
def list_bidders(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.AUDIT_REVIEWER
    )),
):
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
def get_bidder(
    tender_id: str,
    bidder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    if current_user.role == UserRole.BIDDER and bidder.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    out = BidderOut.model_validate(bidder)
    out.document_count = len(bidder.documents)
    return out


# ── Document upload: BIDDER role only, own record only ────────────────────────
@router.post("/{bidder_id}/documents", response_model=DocumentOut, status_code=201)
def upload_document(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    doc_category: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """Only the BIDDER who owns this profile can upload documents. Officers cannot."""
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")

    if bidder.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only upload documents to your own bidder profile.")

    if bidder.submission_confirmed:
        raise HTTPException(
            status_code=409,
            detail="Submission is locked. You cannot upload documents after confirming your submission. Contact the procurement officer if you need to make changes."
        )

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
        uploaded_by=current_user.user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    audit_service.log_event(
        db=db,
        event_type=AuditEventType.BIDDER_UPLOADED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={"doc_id": doc.doc_id, "bidder_id": bidder_id, "filename": file.filename},
        tender_id=tender_id,
        bidder_id=bidder_id,
    )

    background_tasks.add_task(_process_document_bg, doc.doc_id)
    return doc


# ── Bulk document upload: BIDDER role only, own record only ───────────────────
@router.post("/{bidder_id}/documents/bulk", response_model=List[DocumentOut], status_code=201)
def upload_documents_bulk(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    doc_category: str = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """Upload multiple documents in one request. Each file is OCR-processed independently."""
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    if bidder.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only upload documents to your own bidder profile.")
    if bidder.submission_confirmed:
        raise HTTPException(status_code=409, detail="Submission is locked. You cannot upload documents after confirming your submission.")
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    created_docs = []
    for file in files:
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
            uploaded_by=current_user.user_id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        audit_service.log_event(
            db=db,
            event_type=AuditEventType.BIDDER_UPLOADED,
            actor_id=current_user.user_id,
            actor_type="HUMAN",
            payload={"doc_id": doc.doc_id, "bidder_id": bidder_id, "filename": file.filename},
            tender_id=tender_id,
            bidder_id=bidder_id,
        )

        background_tasks.add_task(_process_document_bg, doc.doc_id)
        created_docs.append(doc)

    return created_docs


# ── Documents list: internal staff OR own bidder ───────────────────────────────
@router.get("/{bidder_id}/documents", response_model=List[DocumentOut])
def list_documents(
    tender_id: str,
    bidder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    if current_user.role == UserRole.BIDDER and bidder.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    if current_user.role == UserRole.AUDIT_REVIEWER:
        raise HTTPException(status_code=403, detail="Audit Reviewers cannot view raw bidder documents.")
    return bidder.documents


# ── Evaluation trigger: Procurement Officer + above ───────────────────────────
@router.post("/{bidder_id}/evaluate", response_model=dict)
def trigger_evaluation(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    background_tasks.add_task(_run_extraction_and_rules_bg, bidder_id)
    return {
        "status": "evaluation_triggered",
        "bidder_id": bidder_id,
        "submission_confirmed": bidder.submission_confirmed,
        "kyc_auto_run": True,
    }


# ── Bulk evaluate all bidders in a tender ─────────────────────────────────────
@router.post("/evaluate-all", response_model=dict)
def evaluate_all_bidders(
    tender_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    """Trigger evaluation for every registered bidder in this tender in one shot."""
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    bidders = tender.bidders
    if not bidders:
        raise HTTPException(status_code=400, detail="No bidders registered for this tender.")

    approved_criteria = [c for c in tender.criteria if c.is_approved]
    if not approved_criteria:
        raise HTTPException(status_code=400, detail="No approved criteria — approve criteria before running evaluation.")

    triggered = []
    for bidder in bidders:
        background_tasks.add_task(_run_extraction_and_rules_bg, bidder.bidder_id)
        triggered.append(bidder.bidder_id)

    return {
        "status": "bulk_evaluation_triggered",
        "tender_id": tender_id,
        "triggered_count": len(triggered),
        "bidder_ids": triggered,
    }


# ── Confirm submission: BIDDER role, own record only ──────────────────────────
@router.post("/{bidder_id}/confirm-submission", response_model=dict)
def confirm_submission(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """
    Bidder locks their submission. After this:
    - No more document uploads or deletes allowed
    - KYC check runs automatically in the background
    - Officer can now trigger eligibility evaluation
    """
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    if bidder.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only confirm your own submission.")
    if bidder.submission_confirmed:
        raise HTTPException(status_code=409, detail="Submission already confirmed.")

    if not bidder.documents:
        raise HTTPException(status_code=400, detail="Please upload at least one document before confirming your submission.")

    bidder.submission_confirmed = True
    bidder.submission_confirmed_at = datetime.utcnow()
    db.commit()

    audit_service.log_event(
        db=db,
        event_type=AuditEventType.SUBMISSION_CONFIRMED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={
            "bidder_id": bidder_id,
            "company_name": bidder.company_name,
            "document_count": len(bidder.documents),
        },
        tender_id=tender_id,
        bidder_id=bidder_id,
    )

    # Run KYC in background immediately after confirmation
    background_tasks.add_task(_run_kyc_bg, bidder_id)

    return {
        "status": "submission_confirmed",
        "bidder_id": bidder_id,
        "company_name": bidder.company_name,
        "document_count": len(bidder.documents),
        "kyc_status": "running",
        "message": "Submission locked. KYC verification is running in the background.",
    }


def _run_kyc_bg(bidder_id: str):
    """Background task to run KYC for a bidder after submission confirmation."""
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
        if not bidder:
            return
        _run_kyc_for_bidder(bidder, db)
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Background KYC failed for bidder {bidder_id}: {e}")
    finally:
        db.close()


# ── Document delete: BIDDER only, pre-confirmation ────────────────────────────
@router.delete("/{bidder_id}/documents/{doc_id}", status_code=204)
def delete_document(
    tender_id: str,
    bidder_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """
    Bidder can delete their own documents only before submission is confirmed.
    After confirmation the submission is locked.
    """
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    if bidder.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only delete documents from your own bidder profile.")

    if bidder.submission_confirmed:
        raise HTTPException(
            status_code=409,
            detail="Submission is locked. Documents cannot be deleted after confirming your submission. Contact the procurement officer if there is an error."
        )

    doc = db.query(BidderDocument).filter(BidderDocument.doc_id == doc_id, BidderDocument.bidder_id == bidder_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    filename = doc.original_filename or doc.filename
    storage = doc.storage_path

    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_DELETED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={"doc_id": doc_id, "bidder_id": bidder_id, "filename": filename},
        tender_id=tender_id,
        bidder_id=bidder_id,
    )

    db.delete(doc)
    db.commit()

    try:
        if storage:
            Path(storage).unlink(missing_ok=True)
    except Exception:
        pass


# ── Run KYC and persist result: officer-triggered ─────────────────────────────
@router.post("/{bidder_id}/run-kyc", response_model=dict)
def run_kyc_for_bidder_endpoint(
    tender_id: str,
    bidder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    """Run KYC checks for a bidder and persist the result to the database."""
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    try:
        from backend.services.kyc_service import run_full_kyc
        result = run_full_kyc(
            company_name=bidder.company_name,
            gstin=bidder.gstin,
            pan=bidder.pan,
            sandbox=True,
        )
        status = result.get("overall_kyc_status", "REVIEW")
        bidder.kyc_status = status
        bidder.kyc_run_at = datetime.utcnow()
        db.commit()
        audit_service.log_event(
            db=db,
            event_type=AuditEventType.KYC_COMPLETED,
            actor_id=current_user.user_id,
            actor_type="HUMAN",
            payload={
                "bidder_id": bidder_id,
                "kyc_status": status,
                "triggered_by": "officer_manual",
                "issues": result.get("issues", []),
            },
            tender_id=tender_id,
            bidder_id=bidder_id,
        )
        return {**result, "kyc_status_saved": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KYC check failed: {str(e)}")


# ── Evidence list: internal staff only ────────────────────────────────────────
@router.get("/{bidder_id}/evidence", response_model=List[EvidenceOut])
def get_evidence(
    tender_id: str,
    bidder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.AUDIT_REVIEWER
    )),
):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id, Bidder.tender_id == tender_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    return bidder.evidence_records
