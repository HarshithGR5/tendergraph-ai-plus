from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.database import get_db
from backend.models.tables import AuditEvent, AuditEventType, User
from backend.services.audit_service import verify_chain

router = APIRouter(prefix="/audit", tags=["audit-global"])


class AuditEventOut(BaseModel):
    event_id: str
    event_type: AuditEventType
    tender_id: Optional[str]
    bidder_id: Optional[str]
    actor_id: str
    actor_type: str
    payload_json: Optional[dict]
    prev_hash: Optional[str]
    hash: str
    timestamp: datetime

    class Config:
        from_attributes = True


class ChainVerification(BaseModel):
    valid: bool
    event_count: int
    broken_at: Optional[str]
    broken_at_timestamp: Optional[str] = None


@router.get("/", response_model=List[AuditEventOut])
def list_all_audit_events(
    event_type: Optional[AuditEventType] = None,
    actor_id: Optional[str] = None,
    tender_id: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AuditEvent)
    if event_type:
        query = query.filter(AuditEvent.event_type == event_type)
    if actor_id:
        query = query.filter(AuditEvent.actor_id == actor_id)
    if tender_id:
        query = query.filter(AuditEvent.tender_id == tender_id)
    return query.order_by(AuditEvent.timestamp.desc()).limit(limit).all()


@router.get("/verify-chain", response_model=ChainVerification)
def verify_audit_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = verify_chain(db)
    return ChainVerification(**result)
