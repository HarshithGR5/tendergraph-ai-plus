import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role, hash_password, verify_password
from backend.config import settings
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, CriterionCategory, MandatoryStatus, OCRStatus,
    Tender, TenderCriterion, TenderStatus, User, UserRole
)
from backend.services import audit_service
from backend.services.tender_parser import process_tender

router = APIRouter(prefix="/tenders", tags=["tenders"])

# Roles that can upload / manage tenders
TENDER_MANAGERS = (UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)
# Roles that can approve criteria / override verdicts
APPROVERS = (UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)
# All internal staff (not bidders)
INTERNAL_STAFF = (UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.AUDIT_REVIEWER)


class ThresholdJson(BaseModel):
    type: str
    value: Optional[float] = None
    unit: Optional[str] = None
    condition: Optional[str] = None


class CriterionOut(BaseModel):
    criterion_id: str
    tender_id: str
    category: CriterionCategory
    mandatory_status: MandatoryStatus
    description: str
    threshold_json: Optional[dict]
    required_document: Optional[str]
    source_clause: Optional[str]
    source_page: Optional[int]
    extraction_confidence: Optional[float]
    ambiguity_flags: Optional[list]
    is_approved: bool
    is_manually_added: bool
    reviewer_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CriterionUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[CriterionCategory] = None
    mandatory_status: Optional[MandatoryStatus] = None
    threshold_json: Optional[dict] = None
    required_document: Optional[str] = None
    source_clause: Optional[str] = None
    source_page: Optional[int] = None
    reviewer_notes: Optional[str] = None


class ApprovePayload(BaseModel):
    reviewer_notes: Optional[str] = None


class CriterionCreate(BaseModel):
    category: CriterionCategory
    mandatory_status: MandatoryStatus = MandatoryStatus.MANDATORY
    description: str
    threshold_json: Optional[dict] = None
    required_document: Optional[str] = None
    source_clause: Optional[str] = None
    source_page: Optional[int] = None


class TenderOut(BaseModel):
    tender_id: str
    title: str
    issuing_authority: Optional[str]
    nit_number: Optional[str]
    closing_date: Optional[datetime]
    emd_amount: Optional[float]
    status: TenderStatus
    officer_id: str
    original_filename: Optional[str]
    ocr_status: Optional[OCRStatus]
    created_at: datetime
    updated_at: datetime
    criteria_count: Optional[int] = 0
    has_view_password: bool = False

    class Config:
        from_attributes = True


class VerifyViewPasswordPayload(BaseModel):
    password: str


def _save_upload(file: UploadFile, subfolder: str) -> str:
    folder = Path(settings.storage_base_path) / subfolder
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{ext}"
    dest = folder / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return str(dest)


def _process_tender_bg(tender_id: str):
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        process_tender(tender_id, db)
    finally:
        db.close()


def _build_tender_out(t: Tender) -> TenderOut:
    out = TenderOut.model_validate(t)
    out.criteria_count = len(t.criteria)
    out.has_view_password = bool(t.view_password_hash)
    return out


# ── Tender upload: Senior Procurement Officer + Admin only ─────────────────────────────────
@router.post("/", response_model=TenderOut, status_code=201)
def upload_tender(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    issuing_authority: str = Form(None),
    nit_number: str = Form(None),
    closing_date: str = Form(None),
    emd_amount: float = Form(None),
    view_password: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    allowed_ext = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".tiff"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    storage_path = _save_upload(file, "tenders")
    closing_dt = None
    if closing_date:
        try:
            closing_dt = datetime.fromisoformat(closing_date)
        except ValueError:
            pass

    tender = Tender(
        title=title,
        issuing_authority=issuing_authority,
        nit_number=nit_number,
        closing_date=closing_dt,
        emd_amount=emd_amount,
        officer_id=current_user.user_id,
        storage_path=storage_path,
        original_filename=file.filename,
        file_type=ext.lstrip("."),
        status=TenderStatus.UPLOADING,
        ocr_status=OCRStatus.PENDING,
        view_password_hash=hash_password(view_password) if view_password else None,
    )
    db.add(tender)
    db.commit()
    db.refresh(tender)

    audit_service.log_event(
        db=db,
        event_type=AuditEventType.TENDER_UPLOADED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={"tender_id": tender.tender_id, "title": title, "filename": file.filename},
        tender_id=tender.tender_id,
    )

    background_tasks.add_task(_process_tender_bg, tender.tender_id)
    return _build_tender_out(tender)


# ── List tenders: all internal staff + bidders (public list) ──────────────────
@router.get("/", response_model=List[TenderOut])
def list_tenders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenders = db.query(Tender).order_by(Tender.created_at.desc()).all()
    return [_build_tender_out(t) for t in tenders]


@router.get("/{tender_id}", response_model=TenderOut)
def get_tender(tender_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    return _build_tender_out(tender)


# ── Verify view password for bidder applications ───────────────────────────────
@router.post("/{tender_id}/verify-view-password", response_model=dict)
def verify_view_password(
    tender_id: str,
    payload: VerifyViewPasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    if not tender.view_password_hash:
        return {"verified": True}
    if not verify_password(payload.password, tender.view_password_hash):
        raise HTTPException(status_code=403, detail="Incorrect viewing password.")
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.BIDDER_DOC_VIEWED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={"tender_id": tender_id, "action": "view_password_verified"},
        tender_id=tender_id,
    )
    return {"verified": True}


# ── Criteria: read by all staff; write by approvers only ──────────────────────
@router.get("/{tender_id}/criteria", response_model=List[CriterionOut])
def get_criteria(tender_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    return tender.criteria


@router.post("/{tender_id}/criteria", response_model=CriterionOut, status_code=201)
def add_criterion(
    tender_id: str,
    payload: CriterionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    criterion = TenderCriterion(
        tender_id=tender_id,
        category=payload.category,
        mandatory_status=payload.mandatory_status,
        description=payload.description,
        threshold_json=payload.threshold_json,
        required_document=payload.required_document,
        source_clause=payload.source_clause,
        source_page=payload.source_page,
        extraction_confidence=1.0,
        is_manually_added=True,
        is_approved=True,
    )
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.patch("/{tender_id}/criteria/{criterion_id}", response_model=CriterionOut)
def update_criterion(
    tender_id: str,
    criterion_id: str,
    payload: CriterionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    criterion = db.query(TenderCriterion).filter(
        TenderCriterion.criterion_id == criterion_id,
        TenderCriterion.tender_id == tender_id,
    ).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(criterion, field, value)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.delete("/{tender_id}", status_code=204)
def delete_tender(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    """
    Delete a tender. Only allowed if no bidders have registered for it yet.
    This prevents accidental deletion once evaluation is underway.
    """
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    if tender.bidders:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete tender with {len(tender.bidders)} registered bidder(s). Bidders must be removed first."
        )

    audit_service.log_event(
        db=db,
        event_type=AuditEventType.TENDER_DELETED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={"tender_id": tender_id, "title": tender.title},
        tender_id=tender_id,
    )

    storage = tender.storage_path
    db.delete(tender)
    db.commit()

    try:
        if storage:
            Path(storage).unlink(missing_ok=True)
    except Exception:
        pass


@router.post("/{tender_id}/criteria/approve-all", response_model=dict)
def approve_all_criteria(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    count = 0
    for c in tender.criteria:
        c.is_approved = True
        count += 1
    tender.status = TenderStatus.CRITERIA_APPROVED
    db.commit()
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.CRITERION_SCHEMA_APPROVED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={"tender_id": tender_id, "approved_count": count},
        tender_id=tender_id,
    )
    return {"approved_count": count, "status": "CRITERIA_APPROVED"}


@router.post("/{tender_id}/criteria/{criterion_id}/approve", response_model=CriterionOut)
def approve_criterion(
    tender_id: str,
    criterion_id: str,
    payload: Optional[ApprovePayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    criterion = db.query(TenderCriterion).filter(
        TenderCriterion.criterion_id == criterion_id,
        TenderCriterion.tender_id == tender_id,
    ).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found.")
    criterion.is_approved = True
    if payload and payload.reviewer_notes:
        criterion.reviewer_notes = payload.reviewer_notes
    db.commit()
    db.refresh(criterion)
    return criterion


@router.delete("/{tender_id}/criteria/{criterion_id}", status_code=204)
def delete_criterion(
    tender_id: str,
    criterion_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    criterion = db.query(TenderCriterion).filter(
        TenderCriterion.criterion_id == criterion_id,
        TenderCriterion.tender_id == tender_id,
    ).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found.")
    db.delete(criterion)
    db.commit()
