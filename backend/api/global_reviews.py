from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role
from backend.database import get_db
from backend.models.tables import Bidder, ReviewTask, ReviewTaskStatus, Tender, User, UserRole, VerdictValue

router = APIRouter(prefix="/reviews", tags=["reviews-global"])


class GlobalReviewTaskOut(BaseModel):
    task_id: str
    tender_id: Optional[str] = None
    tender_title: Optional[str] = None
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


# ── Global review queue: internal staff only (not bidders) ────────────────────
@router.get("/", response_model=List[GlobalReviewTaskOut])
def list_all_review_tasks(
    status: Optional[ReviewTaskStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    query = (
        db.query(ReviewTask)
        .join(Bidder, ReviewTask.bidder_id == Bidder.bidder_id)
    )
    if status:
        query = query.filter(ReviewTask.status == status)
    query = query.order_by(ReviewTask.priority.asc(), ReviewTask.assigned_at.asc())
    tasks = query.all()

    results = []
    for task in tasks:
        out = GlobalReviewTaskOut.model_validate(task)
        if task.bidder:
            out.company_name = task.bidder.company_name
            tender = db.query(Tender).filter(Tender.tender_id == task.bidder.tender_id).first()
            if tender:
                out.tender_id = tender.tender_id
                out.tender_title = tender.title
        if task.verdict and task.verdict.criterion:
            out.criterion_description = task.verdict.criterion.description[:200]
        results.append(out)
    return results
