from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, Bidder, ReviewTask, ReviewTaskStatus, Tender, User, UserRole, VerdictValue
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

    class Config:
        from_attributes = True


class ResolvePayload(BaseModel):
    resolution_verdict: VerdictValue
    resolution_notes: str


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

    results = []
    for task in tasks:
        out = ReviewTaskOut.model_validate(task)
        if task.bidder:
            out.company_name = task.bidder.company_name
        if task.verdict and task.verdict.criterion:
            out.criterion_description = task.verdict.criterion.description[:200]
        results.append(out)
    return results


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
    out = ReviewTaskOut.model_validate(task)
    if task.bidder:
        out.company_name = task.bidder.company_name
    if task.verdict and task.verdict.criterion:
        out.criterion_description = task.verdict.criterion.description[:200]
    return out


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

    out = ReviewTaskOut.model_validate(task)
    if task.bidder:
        out.company_name = task.bidder.company_name
    if task.verdict and task.verdict.criterion:
        out.criterion_description = task.verdict.criterion.description[:200]
    return out
