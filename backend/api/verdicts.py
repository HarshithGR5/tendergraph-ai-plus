from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role
from backend.config import settings
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, Bidder, CriterionVerdict, OverallVerdict,
    ReviewTask, ReviewTaskStatus, Tender, User, UserRole, VerdictValue
)
from backend.services import audit_service

router = APIRouter(prefix="/tenders/{tender_id}", tags=["verdicts"])


class VerdictOut(BaseModel):
    verdict_id: str
    bidder_id: str
    criterion_id: str
    evidence_id: Optional[str]
    verdict: VerdictValue
    reason: str
    rule_applied: Optional[str]
    confidence: Optional[float]
    decided_by: str
    decided_at: datetime
    human_reviewed: bool
    override_verdict: Optional[VerdictValue]
    override_reason: Optional[str]
    override_at: Optional[datetime]

    class Config:
        from_attributes = True


class MatrixCell(BaseModel):
    bidder_id: str
    company_name: str
    criterion_id: str
    verdict: VerdictValue
    confidence: Optional[float]
    override_verdict: Optional[VerdictValue]


class BidderMatrixRow(BaseModel):
    bidder_id: str
    company_name: str
    overall_verdict: OverallVerdict
    criteria_verdicts: List[VerdictOut]


class OverridePayload(BaseModel):
    new_verdict: VerdictValue
    override_reason: str

    @field_validator("override_reason")
    @classmethod
    def reason_min_length(cls, v):
        if len(v.strip()) < 50:
            raise ValueError("Override reason must be at least 50 characters.")
        return v.strip()


# ── Verdicts: internal staff only ─────────────────────────────────────────────
@router.get("/verdicts", response_model=List[VerdictOut])
def list_verdicts(
    tender_id: str,
    bidder_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.AUDIT_REVIEWER
    )),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    query = db.query(CriterionVerdict).join(
        Bidder, CriterionVerdict.bidder_id == Bidder.bidder_id
    ).filter(Bidder.tender_id == tender_id)
    if bidder_id:
        query = query.filter(CriterionVerdict.bidder_id == bidder_id)
    return query.all()


@router.get("/matrix", response_model=List[BidderMatrixRow])
def get_evaluation_matrix(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.AUDIT_REVIEWER
    )),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    rows = []
    for bidder in tender.bidders:
        rows.append(BidderMatrixRow(
            bidder_id=bidder.bidder_id,
            company_name=bidder.company_name,
            overall_verdict=bidder.overall_verdict,
            criteria_verdicts=bidder.verdicts,
        ))
    return rows


# ── Override: Senior Officer + Admin only ─────────────────────────────────────
@router.post("/bidders/{bidder_id}/verdicts/{verdict_id}/override", response_model=VerdictOut)
def override_verdict(
    tender_id: str,
    bidder_id: str,
    verdict_id: str,
    payload: OverridePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    verdict = db.query(CriterionVerdict).filter(
        CriterionVerdict.verdict_id == verdict_id,
        CriterionVerdict.bidder_id == bidder_id,
    ).first()
    if not verdict:
        raise HTTPException(status_code=404, detail="Verdict not found.")

    original_verdict = verdict.verdict.value
    verdict.override_verdict = payload.new_verdict
    verdict.override_reason = payload.override_reason
    verdict.override_officer_id = current_user.user_id
    verdict.override_at = datetime.utcnow()
    verdict.human_reviewed = True

    review_task = db.query(ReviewTask).filter(
        ReviewTask.criterion_verdict_id == verdict_id
    ).first()
    if review_task:
        review_task.status = ReviewTaskStatus.COMPLETED
        review_task.completed_at = datetime.utcnow()
        review_task.resolution_verdict = payload.new_verdict
        review_task.resolution_notes = payload.override_reason
        review_task.resolved_by = current_user.user_id

    db.commit()

    audit_service.log_event(
        db=db,
        event_type=AuditEventType.HUMAN_OVERRIDE_APPLIED,
        actor_id=current_user.user_id,
        actor_type="HUMAN",
        payload={
            "verdict_id": verdict_id,
            "bidder_id": bidder_id,
            "original_verdict": original_verdict,
            "new_verdict": payload.new_verdict.value,
            "override_reason": payload.override_reason,
        },
        tender_id=tender_id,
        bidder_id=bidder_id,
    )

    _recalculate_overall_verdict(bidder_id, db)
    db.refresh(verdict)
    return verdict


def _recalculate_overall_verdict(bidder_id: str, db: Session):
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
    if not bidder:
        return
    from backend.models.tables import MandatoryStatus
    mandatory_verdicts = [
        v for v in bidder.verdicts
        if v.criterion.mandatory_status == MandatoryStatus.MANDATORY
    ]
    effective = lambda v: v.override_verdict or v.verdict
    if any(effective(v) == VerdictValue.NOT_ELIGIBLE for v in mandatory_verdicts):
        bidder.overall_verdict = OverallVerdict.NOT_ELIGIBLE
    elif any(effective(v) == VerdictValue.NEEDS_MANUAL_REVIEW for v in mandatory_verdicts):
        bidder.overall_verdict = OverallVerdict.NEEDS_MANUAL_REVIEW
    else:
        bidder.overall_verdict = OverallVerdict.ELIGIBLE
    db.commit()
