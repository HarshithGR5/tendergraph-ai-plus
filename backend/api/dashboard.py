from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.api.auth import get_current_user, require_role
from backend.database import get_db
from backend.models.tables import Bidder, OverallVerdict, ReviewTask, ReviewTaskStatus, Tender, User, UserRole

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    total_tenders: int
    total_bidders: int
    eligible: int
    not_eligible: int
    needs_review: int
    pending: int
    open_review_tasks: int
    evaluation_complete_tenders: int


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN, UserRole.AUDIT_REVIEWER
    )),
):
    tenders = db.query(Tender).all()
    bidders = db.query(Bidder).all()

    eligible = sum(1 for b in bidders if b.overall_verdict == OverallVerdict.ELIGIBLE)
    not_eligible = sum(1 for b in bidders if b.overall_verdict == OverallVerdict.NOT_ELIGIBLE)
    needs_review = sum(1 for b in bidders if b.overall_verdict == OverallVerdict.NEEDS_MANUAL_REVIEW)
    pending = sum(1 for b in bidders if b.overall_verdict == OverallVerdict.PENDING)

    open_tasks = db.query(ReviewTask).filter(
        ReviewTask.status.in_([ReviewTaskStatus.OPEN, ReviewTaskStatus.IN_PROGRESS])
    ).count()

    complete_tenders = sum(1 for t in tenders if t.status.value == "EVALUATION_COMPLETE")

    return DashboardStats(
        total_tenders=len(tenders),
        total_bidders=len(bidders),
        eligible=eligible,
        not_eligible=not_eligible,
        needs_review=needs_review,
        pending=pending,
        open_review_tasks=open_tasks,
        evaluation_complete_tenders=complete_tenders,
    )
