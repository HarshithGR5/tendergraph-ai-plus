from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, Bidder, BidderDocument, BidderEvidence,
    MandatoryStatus, OverallVerdict,
    ReviewTask, ReviewTaskStatus, Tender, User, UserRole, VerdictValue
)
from backend.services import audit_service

router = APIRouter(prefix="/tenders/{tender_id}/reviews", tags=["reviews"])


class ReviewTaskOut(BaseModel):
    task_id: str
    criterion_verdict_id: str
    bidder_id: str
    company_name: Optional[str] = None
    criterion_description: Optional[str] = None
    assigned_to: Optional[str]
    assigned_at: datetime
    reason_for_review: str
    trigger_condition: Optional[str]
    status: ReviewTaskStatus
    priority: int
    completed_at: Optional[datetime]
    resolution_notes: Optional[str]
    resolution_verdict: Optional[VerdictValue]
    evidence_source_doc_name: Optional[str] = None
    evidence_source_page: Optional[int] = None
    evidence_extracted_text: Optional[str] = None
    evidence_ocr_confidence: Optional[float] = None
    evidence_extraction_confidence: Optional[float] = None

    class Config:
        from_attributes = True


class ResolvePayload(BaseModel):
    resolution_verdict: VerdictValue
    resolution_notes: str


def _enrich_task(task: ReviewTask, db: Session) -> ReviewTaskOut:
    out = ReviewTaskOut.model_validate(task)
    if task.bidder:
        out.company_name = task.bidder.company_name
    if task.verdict and task.verdict.criterion:
        out.criterion_description = task.verdict.criterion.description[:200]
    if task.verdict and task.verdict.evidence:
        ev: BidderEvidence = task.verdict.evidence
        out.evidence_source_page = ev.source_page
        out.evidence_ocr_confidence = ev.ocr_confidence
        out.evidence_extraction_confidence = ev.extraction_confidence
        if ev.extracted_text:
            out.evidence_extracted_text = ev.extracted_text[:400]
        if ev.source_doc_id:
            doc = db.query(BidderDocument).filter(
                BidderDocument.doc_id == ev.source_doc_id
            ).first()
            if doc:
                out.evidence_source_doc_name = doc.original_filename or doc.filename

        # Build human-readable escalation reason from evidence context
        notes = (ev.extraction_notes or "").strip()
        conf = ev.extraction_confidence or 0.0
        crit_desc = (task.verdict.criterion.description[:120] if task.verdict.criterion else "this criterion")
        raw_reason = task.reason_for_review or ""

        if notes and len(notes) > 15 and not notes.lower().startswith("no evidence"):
            # extraction_notes contains real document context — use it directly
            conf_label = f" (extraction confidence: {conf:.0%})" if conf > 0 else ""
            out.reason_for_review = f"{notes}{conf_label}"
        elif raw_reason.startswith("Confidence gate:"):
            # Replace system jargon with plain English
            out.reason_for_review = (
                f"The submitted evidence could not be automatically verified for: \"{crit_desc}\". "
                f"The AI extracted text from the document but confidence was too low ({conf:.0%}) "
                f"to make an automatic eligibility decision. Please review the evidence below and "
                f"mark as Eligible or Not Eligible."
            )
        elif notes:
            out.reason_for_review = notes
        # else keep original reason_for_review as-is

    return out


# ── List review tasks: procurement + senior + admin ────────────────────────────
@router.get("/", response_model=List[ReviewTaskOut])
def list_review_tasks(
    tender_id: str,
    status: Optional[ReviewTaskStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    query = (
        db.query(ReviewTask)
        .join(Bidder, ReviewTask.bidder_id == Bidder.bidder_id)
        .filter(Bidder.tender_id == tender_id)
    )
    if status:
        query = query.filter(ReviewTask.status == status)
    query = query.order_by(ReviewTask.priority.asc(), ReviewTask.assigned_at.asc())
    tasks = query.all()

    return [_enrich_task(t, db) for t in tasks]


# ── Assign: procurement + senior + admin can assign tasks ─────────────────────
@router.post("/{task_id}/assign", response_model=ReviewTaskOut)
def assign_task(
    tender_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    task = db.query(ReviewTask).filter(ReviewTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found.")
    task.assigned_to = current_user.user_id
    task.status = ReviewTaskStatus.IN_PROGRESS
    db.commit()
    audit_service.log_event(
        db=db, event_type=AuditEventType.HUMAN_REVIEW_ASSIGNED,
        actor_id=current_user.user_id, actor_type="HUMAN",
        payload={"task_id": task_id, "assigned_to": current_user.user_id},
        tender_id=tender_id, bidder_id=task.bidder_id,
    )
    return _enrich_task(task, db)


# ── Resolve/override: Senior Officer + Admin ONLY ─────────────────────────────
@router.post("/{task_id}/resolve", response_model=ReviewTaskOut)
def resolve_task(
    tender_id: str,
    task_id: str,
    payload: ResolvePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    task = db.query(ReviewTask).filter(ReviewTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found.")

    task.status = ReviewTaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()
    task.resolution_verdict = payload.resolution_verdict
    task.resolution_notes = payload.resolution_notes
    task.resolved_by = current_user.user_id

    if task.verdict:
        task.verdict.override_verdict = payload.resolution_verdict
        task.verdict.override_reason = payload.resolution_notes
        task.verdict.override_officer_id = current_user.user_id
        task.verdict.override_at = datetime.utcnow()
        task.verdict.human_reviewed = True

    db.flush()

    # Recalculate bidder's overall verdict based on all updated criterion verdicts
    if task.bidder:
        bidder_obj = task.bidder
        tender_obj = bidder_obj.tender
        approved_criteria = [c for c in tender_obj.criteria if c.is_approved]
        verdicts_by_crit = {v.criterion_id: v for v in bidder_obj.verdicts}

        mandatory_not_eligible = False
        any_mandatory_review = False

        for c in approved_criteria:
            cv = verdicts_by_crit.get(c.criterion_id)
            if cv is None:
                continue
            eff = cv.override_verdict or cv.verdict
            if c.mandatory_status == MandatoryStatus.MANDATORY:
                if eff == VerdictValue.NOT_ELIGIBLE:
                    mandatory_not_eligible = True
                    break
                elif eff == VerdictValue.NEEDS_MANUAL_REVIEW:
                    any_mandatory_review = True

        if mandatory_not_eligible:
            bidder_obj.overall_verdict = OverallVerdict.NOT_ELIGIBLE
        elif any_mandatory_review:
            bidder_obj.overall_verdict = OverallVerdict.NEEDS_MANUAL_REVIEW
        else:
            bidder_obj.overall_verdict = OverallVerdict.ELIGIBLE

    db.commit()

    audit_service.log_event(
        db=db, event_type=AuditEventType.HUMAN_OVERRIDE_APPLIED,
        actor_id=current_user.user_id, actor_type="HUMAN",
        payload={
            "task_id": task_id,
            "resolution_verdict": payload.resolution_verdict.value,
            "resolution_notes": payload.resolution_notes,
        },
        tender_id=tender_id, bidder_id=task.bidder_id,
    )

    return _enrich_task(task, db)
