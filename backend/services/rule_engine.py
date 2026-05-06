"""
Hybrid Eligibility Verification Engine.
Reads only from BidderEvidence. Never calls LLM directly.
Emits CriterionVerdict per bidder-criterion pair.
Applies confidence gates and aggregates overall eligibility.
"""
import logging
from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.config import settings
from backend.models.tables import (
    AuditEventType, Bidder, BidderEvidence, CriterionVerdict, MandatoryStatus,
    OverallVerdict, ReviewTask, ReviewTaskStatus, TenderCriterion,
    CriterionCategory, VerdictValue
)
from backend.rules.financial import check_financial_criterion
from backend.rules.technical import check_technical_criterion
from backend.rules.compliance import check_compliance_criterion
from backend.services import audit_service

logger = logging.getLogger(__name__)

CONF_MIN = settings.ocr_confidence_threshold
CONF_REVIEW = settings.manual_review_confidence_threshold
SIMILAR_ELIGIBLE = settings.similar_works_eligible_threshold
SIMILAR_REVIEW = settings.similar_works_review_threshold


def _dispatch_rule(
    criterion: TenderCriterion,
    evidence: BidderEvidence,
    tender_date: Optional[date] = None,
) -> Tuple[VerdictValue, str, str]:
    cat = criterion.category
    if cat == CriterionCategory.FINANCIAL:
        return check_financial_criterion(criterion, evidence)
    elif cat == CriterionCategory.TECHNICAL:
        return check_technical_criterion(criterion, evidence, tender_date)
    elif cat in (CriterionCategory.COMPLIANCE, CriterionCategory.COMPLETENESS):
        return check_compliance_criterion(criterion, evidence)
    else:
        return (VerdictValue.NEEDS_MANUAL_REVIEW, "Unknown criterion category — manual review required.", "unknown_category")


def _apply_confidence_gate(
    verdict: VerdictValue,
    reason: str,
    evidence: BidderEvidence,
    criterion: TenderCriterion,
) -> Tuple[VerdictValue, str]:
    conf = evidence.extraction_confidence or 0.0

    if conf < CONF_MIN:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            f"Confidence gate: extraction confidence {conf:.2f} below minimum {CONF_MIN}. {reason}",
        )

    if verdict == VerdictValue.NOT_ELIGIBLE and conf < CONF_REVIEW:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            f"Confidence gate: NOT_ELIGIBLE verdict requires confidence ≥ {CONF_REVIEW}; "
            f"current confidence {conf:.2f} insufficient for automatic disqualification. {reason}",
        )

    return verdict, reason


def _create_review_task(
    verdict: CriterionVerdict,
    bidder: Bidder,
    reason: str,
    trigger: str,
    db: Session,
    is_mandatory: bool = True,
) -> ReviewTask:
    task = ReviewTask(
        criterion_verdict_id=verdict.verdict_id,
        bidder_id=bidder.bidder_id,
        reason_for_review=reason[:2000],
        trigger_condition=trigger[:200],
        status=ReviewTaskStatus.OPEN,
        priority=1 if is_mandatory else 5,
    )
    db.add(task)
    return task


def evaluate_bidder(bidder_id: str, db: Session) -> Optional[OverallVerdict]:
    bidder = db.query(Bidder).filter(Bidder.bidder_id == bidder_id).first()
    if not bidder:
        logger.error(f"Bidder {bidder_id} not found")
        return None

    tender = bidder.tender
    tender_date = tender.closing_date.date() if tender.closing_date else date.today()
    criteria: List[TenderCriterion] = tender.criteria

    approved_criteria = [c for c in criteria if c.is_approved]
    if not approved_criteria:
        logger.warning(f"No approved criteria for tender {tender.tender_id}")
        return None

    overall = OverallVerdict.ELIGIBLE
    mandatory_not_eligible = False
    any_mandatory_review = False

    for criterion in approved_criteria:
        evidence: Optional[BidderEvidence] = (
            db.query(BidderEvidence)
            .filter(
                BidderEvidence.bidder_id == bidder_id,
                BidderEvidence.criterion_id == criterion.criterion_id,
            )
            .first()
        )

        if evidence is None:
            evidence = BidderEvidence(
                bidder_id=bidder_id,
                criterion_id=criterion.criterion_id,
                extracted_value=None,
                extraction_confidence=0.0,
                ocr_confidence=0.0,
                extraction_notes="No evidence record — bidder may not have submitted required document.",
            )
            db.add(evidence)
            db.flush()

        raw_verdict, raw_reason, rule_applied = _dispatch_rule(criterion, evidence, tender_date)
        final_verdict, final_reason = _apply_confidence_gate(raw_verdict, raw_reason, evidence, criterion)

        existing = (
            db.query(CriterionVerdict)
            .filter(
                CriterionVerdict.bidder_id == bidder_id,
                CriterionVerdict.criterion_id == criterion.criterion_id,
            )
            .first()
        )

        if existing:
            existing.verdict = final_verdict
            existing.reason = final_reason
            existing.rule_applied = rule_applied
            existing.confidence = evidence.extraction_confidence
            existing.evidence_id = evidence.evidence_id
            verdict_record = existing
        else:
            verdict_record = CriterionVerdict(
                bidder_id=bidder_id,
                criterion_id=criterion.criterion_id,
                evidence_id=evidence.evidence_id,
                verdict=final_verdict,
                reason=final_reason,
                rule_applied=rule_applied,
                confidence=evidence.extraction_confidence,
                decided_by="RULE_ENGINE",
            )
            db.add(verdict_record)

        db.flush()

        is_mandatory = criterion.mandatory_status == MandatoryStatus.MANDATORY

        if is_mandatory:
            if final_verdict == VerdictValue.NOT_ELIGIBLE:
                mandatory_not_eligible = True
            elif final_verdict == VerdictValue.NEEDS_MANUAL_REVIEW:
                any_mandatory_review = True

        if final_verdict == VerdictValue.NEEDS_MANUAL_REVIEW:
            _create_review_task(
                verdict=verdict_record,
                bidder=bidder,
                reason=final_reason,
                trigger=rule_applied,
                db=db,
                is_mandatory=is_mandatory,
            )

        audit_service.log_event(
            db=db,
            event_type=AuditEventType.VERDICT_EMITTED,
            actor_id="RULE_ENGINE",
            payload={
                "verdict_id": verdict_record.verdict_id,
                "bidder_id": bidder_id,
                "criterion_id": criterion.criterion_id,
                "verdict": final_verdict.value,
                "reason": final_reason,
                "rule": rule_applied,
                "confidence": evidence.extraction_confidence,
            },
            tender_id=tender.tender_id,
            bidder_id=bidder_id,
        )

    if mandatory_not_eligible:
        overall = OverallVerdict.NOT_ELIGIBLE
    elif any_mandatory_review:
        overall = OverallVerdict.NEEDS_MANUAL_REVIEW
    else:
        overall = OverallVerdict.ELIGIBLE

    bidder.overall_verdict = overall
    bidder.processing_complete = True
    db.commit()

    logger.info(f"Bidder {bidder_id} overall verdict: {overall.value}")
    return overall
