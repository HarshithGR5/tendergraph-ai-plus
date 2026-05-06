"""
Deterministic financial criterion rule functions.
AI never calls these — they read only from BidderEvidence records.
"""
from typing import Tuple
from backend.config import settings
from backend.models.tables import BidderEvidence, TenderCriterion, VerdictValue
from backend.services.extraction_service import normalise_to_inr

CONF_MIN = settings.ocr_confidence_threshold
CONF_REVIEW = settings.manual_review_confidence_threshold
NEAR_THRESHOLD_MARGIN = 0.10


def check_financial_criterion(criterion: TenderCriterion, evidence: BidderEvidence) -> Tuple[VerdictValue, str, str]:
    if evidence.extraction_confidence is not None and evidence.extraction_confidence < CONF_MIN:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            f"Extraction confidence {evidence.extraction_confidence:.2f} is below minimum threshold {CONF_MIN}. "
            "Human officer must verify figure directly from source document.",
            "check_financial_criterion:low_confidence",
        )

    if evidence.extracted_value is None:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            "Required financial figure not found in any submitted document. "
            "Officer to confirm document was not submitted or locate it manually.",
            "check_financial_criterion:value_missing",
        )

    threshold = criterion.threshold_json or {}
    threshold_value = threshold.get("value")
    if threshold_value is None:
        return (
            VerdictValue.ELIGIBLE,
            "No numeric threshold defined for this criterion — document presence verified.",
            "check_financial_criterion:no_threshold",
        )

    unit = evidence.unit or "INR"
    try:
        value_inr = normalise_to_inr(evidence.extracted_value, unit)
    except Exception:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            f"Could not normalise extracted value '{evidence.extracted_value}' to INR for comparison.",
            "check_financial_criterion:normalisation_error",
        )

    threshold_inr = float(threshold_value)
    condition = threshold.get("type", "MINIMUM_CURRENCY_INR")

    if "MINIMUM" in condition:
        if value_inr >= threshold_inr:
            return (
                VerdictValue.ELIGIBLE,
                f"Extracted turnover/value INR {value_inr:,.0f} meets minimum threshold INR {threshold_inr:,.0f}.",
                "check_financial_criterion:meets_threshold",
            )
        near_lower = threshold_inr * (1 - NEAR_THRESHOLD_MARGIN)
        if value_inr >= near_lower and (evidence.extraction_confidence or 1.0) < CONF_REVIEW:
            return (
                VerdictValue.NEEDS_MANUAL_REVIEW,
                f"Value INR {value_inr:,.0f} is within 10% of threshold INR {threshold_inr:,.0f} "
                f"and extraction confidence {evidence.extraction_confidence:.2f} is borderline. "
                "Officer to verify figure directly from source document.",
                "check_financial_criterion:near_threshold_low_confidence",
            )
        return (
            VerdictValue.NOT_ELIGIBLE,
            f"Extracted value INR {value_inr:,.0f} is below required minimum INR {threshold_inr:,.0f}.",
            "check_financial_criterion:below_threshold",
        )

    if "MAXIMUM" in condition:
        if value_inr <= threshold_inr:
            return (
                VerdictValue.ELIGIBLE,
                f"Extracted value INR {value_inr:,.0f} is within maximum limit INR {threshold_inr:,.0f}.",
                "check_financial_criterion:within_maximum",
            )
        return (
            VerdictValue.NOT_ELIGIBLE,
            f"Extracted value INR {value_inr:,.0f} exceeds maximum limit INR {threshold_inr:,.0f}.",
            "check_financial_criterion:exceeds_maximum",
        )

    return (
        VerdictValue.ELIGIBLE,
        f"Financial check passed (condition: {condition}, value: {value_inr:,.0f}).",
        "check_financial_criterion:generic_pass",
    )
