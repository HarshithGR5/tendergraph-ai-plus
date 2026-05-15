from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from backend.api.auth import require_role
from backend.database import get_db
from backend.models.tables import Bidder, CriterionVerdict, OverallVerdict, User, UserRole, VerdictValue

router = APIRouter(prefix="/bidder", tags=["bidder-portal"])


def _humanise_reason(reason: str) -> str:
    """Convert technical rule-engine reason strings into plain human-readable text."""
    if not reason:
        return reason
    # Strip confidence gate technical prefix
    if reason.startswith("Confidence gate: extraction confidence"):
        # Extract original reason after the gate message
        parts = reason.split(". ", 2)
        human_prefix = "Requires manual review — document confidence too low to confirm automatically."
        original = parts[-1] if len(parts) > 1 else ""
        return f"{human_prefix} {original}".strip()
    if reason.startswith("Confidence gate: NOT_ELIGIBLE verdict"):
        parts = reason.split(". ", 2)
        human_prefix = "Requires manual review — the disqualification could not be confirmed automatically due to borderline confidence."
        original = parts[-1] if len(parts) > 1 else ""
        return f"{human_prefix} {original}".strip()
    return reason


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


class BidderVerdictOut(BaseModel):
    criterion_id: str
    criterion_description: Optional[str] = None
    criterion_category: Optional[str] = None
    verdict: VerdictValue
    effective_verdict: VerdictValue
    reason: str
    confidence: Optional[float] = None

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


@router.get("/my-submissions/{bidder_id}/verdicts", response_model=List[BidderVerdictOut])
def get_my_verdicts(
    bidder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BIDDER)),
):
    """Return criterion-level verdicts for a specific bidder registration — only accessible by the bidder who owns it."""
    bidder = db.query(Bidder).filter(
        Bidder.bidder_id == bidder_id,
        Bidder.user_id == current_user.user_id,
    ).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Registration not found or access denied.")

    results = []
    for v in bidder.verdicts:
        effective = v.override_verdict or v.verdict
        raw_reason = v.override_reason if v.override_verdict else v.reason
        results.append(BidderVerdictOut(
            criterion_id=v.criterion_id,
            criterion_description=v.criterion.description if v.criterion else None,
            criterion_category=v.criterion.category.value if v.criterion and hasattr(v.criterion.category, "value") else None,
            verdict=v.verdict,
            effective_verdict=effective,
            reason=_humanise_reason(raw_reason or v.reason),
            confidence=v.confidence,
        ))
    return results
