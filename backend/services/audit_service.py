import hashlib
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

from backend.models.tables import AuditEvent, AuditEventType


def _compute_hash(event_id: str, event_type: str, actor_id: str, payload: dict, prev_hash: str) -> str:
    raw = f"{event_id}|{event_type}|{actor_id}|{json.dumps(payload, sort_keys=True, default=str)}|{prev_hash}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _get_last_hash(db: Session) -> str:
    last = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc()).first()
    return last.hash if last else "GENESIS"


def log_event(
    db: Session,
    event_type: AuditEventType,
    actor_id: str,
    payload: dict,
    tender_id: str = None,
    bidder_id: str = None,
    actor_type: str = "SYSTEM",
) -> AuditEvent:
    event_id = str(uuid.uuid4())
    prev_hash = _get_last_hash(db)
    event_hash = _compute_hash(event_id, event_type.value, actor_id, payload, prev_hash)

    event = AuditEvent(
        event_id=event_id,
        event_type=event_type,
        tender_id=tender_id,
        bidder_id=bidder_id,
        actor_id=actor_id,
        actor_type=actor_type,
        payload_json=payload,
        prev_hash=prev_hash,
        hash=event_hash,
        timestamp=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def verify_chain(db: Session) -> dict:
    events = db.query(AuditEvent).order_by(AuditEvent.timestamp.asc()).all()
    if not events:
        return {"valid": True, "event_count": 0, "broken_at": None}

    prev_hash = "GENESIS"
    for event in events:
        expected = _compute_hash(
            event.event_id,
            event.event_type.value,
            event.actor_id,
            event.payload_json or {},
            prev_hash,
        )
        if expected != event.hash:
            return {
                "valid": False,
                "event_count": len(events),
                "broken_at": event.event_id,
                "broken_at_timestamp": event.timestamp.isoformat(),
            }
        prev_hash = event.hash

    return {"valid": True, "event_count": len(events), "broken_at": None}
