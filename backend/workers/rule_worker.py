import logging

from backend.database import SessionLocal
from backend.models.tables import Bidder
from backend.services.rule_engine import evaluate_bidder
from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="backend.workers.rule_worker.run_rule_engine", bind=True, max_retries=1)
def run_rule_engine(self, bidder_id: str):
    db = SessionLocal()
    try:
        result = evaluate_bidder(bidder_id, db)
        return {
            "status": "success",
            "bidder_id": bidder_id,
            "overall_verdict": result.value if result else "ERROR",
        }
    except Exception as e:
        logger.exception(f"Rule worker failed for bidder {bidder_id}: {e}")
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()


@celery_app.task(name="backend.workers.rule_worker.run_full_pipeline", bind=True, max_retries=1)
def run_full_pipeline(self, bidder_id: str):
    from backend.workers.extract_worker import extract_bidder_evidence
    db = SessionLocal()
    try:
        bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
        if not bidder:
            return {"status": "error", "message": "Bidder not found"}
        db.close()

        extract_bidder_evidence(bidder_id)
        run_rule_engine(bidder_id)
        return {"status": "success", "bidder_id": bidder_id}
    except Exception as e:
        logger.exception(f"Full pipeline failed for bidder {bidder_id}: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        try:
            db.close()
        except Exception:
            pass
