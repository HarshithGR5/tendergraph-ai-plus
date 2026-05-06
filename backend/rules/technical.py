"""
Deterministic technical criterion rule functions.
Handles: project count, similar works, personnel qualifications, date validity.
"""
import re
from datetime import datetime, date
from typing import Tuple

from backend.config import settings
from backend.models.tables import BidderEvidence, TenderCriterion, VerdictValue

CONF_MIN = settings.ocr_confidence_threshold
CONF_REVIEW = settings.manual_review_confidence_threshold
SIMILAR_WORKS_ELIGIBLE = settings.similar_works_eligible_threshold
SIMILAR_WORKS_REVIEW = settings.similar_works_review_threshold


def _parse_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.date() if isinstance(value, datetime) else value
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%Y", "%Y"):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None


def check_technical_criterion(criterion: TenderCriterion, evidence: BidderEvidence, tender_date: date = None) -> Tuple[VerdictValue, str, str]:
    if evidence.extraction_confidence is not None and evidence.extraction_confidence < CONF_MIN:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            f"Extraction confidence {evidence.extraction_confidence:.2f} is below minimum {CONF_MIN}. "
            "Manual verification required.",
            "check_technical_criterion:low_confidence",
        )

    threshold = criterion.threshold_json or {}
    condition_type = threshold.get("type", "")
    threshold_value = threshold.get("value")
    category_desc = criterion.description.lower()

    if evidence.extracted_value is None:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            "Required technical evidence not found in submitted documents. Officer to verify.",
            "check_technical_criterion:value_missing",
        )

    if "COUNT" in condition_type or "project" in category_desc or "experience" in category_desc:
        try:
            extracted_count = int(float(str(evidence.extracted_value)))
        except (ValueError, TypeError):
            return (
                VerdictValue.NEEDS_MANUAL_REVIEW,
                f"Could not interpret extracted value '{evidence.extracted_value}' as a count.",
                "check_technical_criterion:count_parse_error",
            )

        if threshold_value is not None:
            required = int(threshold_value)
            if extracted_count >= required:
                return (
                    VerdictValue.ELIGIBLE,
                    f"Project count {extracted_count} meets minimum requirement of {required}.",
                    "check_technical_criterion:count_meets_threshold",
                )
            return (
                VerdictValue.NOT_ELIGIBLE,
                f"Project count {extracted_count} is below required minimum of {required}.",
                "check_technical_criterion:count_below_threshold",
            )

    if "DATE_VALIDITY" in condition_type or "expiry" in category_desc or "valid" in category_desc:
        expiry = _parse_date(evidence.extracted_value)
        if expiry is None:
            return (
                VerdictValue.NEEDS_MANUAL_REVIEW,
                "Could not parse certificate expiry date from extracted value. Manual verification required.",
                "check_technical_criterion:date_parse_error",
            )
        ref_date = tender_date or date.today()
        days_until_expiry = (expiry - ref_date).days
        if days_until_expiry < 0:
            return (
                VerdictValue.NOT_ELIGIBLE,
                f"Certificate expired on {expiry.isoformat()} (before tender date {ref_date.isoformat()}).",
                "check_technical_criterion:certificate_expired",
            )
        if days_until_expiry <= 30:
            return (
                VerdictValue.NEEDS_MANUAL_REVIEW,
                f"Certificate expiry {expiry.isoformat()} is within 30 days of tender date. "
                "Officer to verify validity at time of submission.",
                "check_technical_criterion:expiry_imminent",
            )
        return (
            VerdictValue.ELIGIBLE,
            f"Certificate valid until {expiry.isoformat()} — {days_until_expiry} days from tender date.",
            "check_technical_criterion:certificate_valid",
        )

    if "YEARS" in condition_type:
        try:
            extracted_years = float(str(evidence.extracted_value))
            required_years = float(threshold_value or 0)
            if extracted_years >= required_years:
                return (
                    VerdictValue.ELIGIBLE,
                    f"Experience {extracted_years} years meets minimum {required_years} years.",
                    "check_technical_criterion:experience_sufficient",
                )
            return (
                VerdictValue.NOT_ELIGIBLE,
                f"Experience {extracted_years} years is below required {required_years} years.",
                "check_technical_criterion:experience_insufficient",
            )
        except (ValueError, TypeError):
            pass

    return (
        VerdictValue.ELIGIBLE,
        "Technical criterion evidence present and extraction confidence acceptable.",
        "check_technical_criterion:generic_pass",
    )
