from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from backend.api.auth import require_role
from backend.database import get_db
from backend.models.tables import Bidder, OverallVerdict, User, UserRole

router = APIRouter(prefix="/bidder", tags=["bidder-portal"])


class MySubmissionOut(BaseModel):
    bidder_id: str
    tender_id: str
    tender_title: Optional[str] = None
    company_name: str
    gstin: Optional[str]
    overall_verdict: OverallVerdict
    processing_complete: bool
    submission_timestamp: datetime
    document_count: int = 0

    class Config:
        from_attributes = True


@router.get("/my-submissions", response_model=List[MySubmissionOut])
def get_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """Return all tenders the current BIDDER user has registered for."""
    bidders = db.query(Bidder).filter(Bidder.user_id == current_user.user_id).all()
    results = []
    for b in bidders:
        results.append(MySubmissionOut(
            bidder_id=b.bidder_id,
            tender_id=b.tender_id,
            tender_title=b.tender.title if b.tender else None,
            company_name=b.company_name,
            gstin=b.gstin,
            overall_verdict=b.overall_verdict,
            processing_complete=b.processing_complete,
            submission_timestamp=b.submission_timestamp,
            document_count=len(b.documents),
        ))
    return results
