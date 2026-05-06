import logging

from backend.database import SessionLocal
from backend.models.tables import AuditEventType, Bidder, TenderCriterion
from backend.services import audit_service
from backend.services.extraction_service import extract_evidence_for_criterion
from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="backend.workers.extract_worker.extract_bidder_evidence", bind=True, max_retries=2)
def extract_bidder_evidence(self, bidder_id: str):
    db = SessionLocal()
    try:
        bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
        if not bidder:
            return {"status": "error", "message": "Bidder not found"}

        tender = bidder.tender
        approved_criteria = [c for c in tender.criteria if c.is_approved]

        results = []
        for criterion in approved_criteria:
            evidence = extract_evidence_for_criterion(bidder_id, criterion, db)
            results.append({
                "criterion_id": criterion.criterion_id,
                "evidence_id": evidence.evidence_id if evidence else None,
                "confidence": evidence.extraction_confidence if evidence else 0.0,
            })

            audit_service.log_event(
                db=db,
                event_type=AuditEventType.EVIDENCE_EXTRACTED,
                actor_id="SYSTEM",
                payload={
                    "bidder_id": bidder_id,
                    "criterion_id": criterion.criterion_id,
                    "evidence_id": evidence.evidence_id if evidence else None,
                    "confidence": evidence.extraction_confidence if evidence else 0.0,
                },
                tender_id=tender.tender_id,
                bidder_id=bidder_id,
            )

        return {"status": "success", "bidder_id": bidder_id, "criteria_processed": len(results)}

    except Exception as e:
        logger.exception(f"Extract worker failed for bidder {bidder_id}: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()
