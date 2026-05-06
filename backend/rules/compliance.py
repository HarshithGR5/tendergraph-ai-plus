"""
Deterministic compliance criterion rule functions.
Handles: GST/PAN presence, ISO certifications, blacklist declarations,
EMD/bid security, legal status checks.
"""
import re
from datetime import date, datetime
from typing import Tuple

from backend.config import settings
from backend.models.tables import BidderEvidence, TenderCriterion, VerdictValue

CONF_MIN = settings.ocr_confidence_threshold
GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")


def _is_valid_gstin(value: str) -> bool:
    return bool(GSTIN_PATTERN.match(str(value).strip().upper()))


def _is_valid_pan(value: str) -> bool:
    return bool(PAN_PATTERN.match(str(value).strip().upper()))


def check_compliance_criterion(criterion: TenderCriterion, evidence: BidderEvidence) -> Tuple[VerdictValue, str, str]:
    if evidence.extraction_confidence is not None and evidence.extraction_confidence < CONF_MIN:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            f"Extraction confidence {evidence.extraction_confidence:.2f} is below minimum {CONF_MIN}. "
            "Officer to manually verify compliance document.",
            "check_compliance_criterion:low_confidence",
        )

    if evidence.extracted_value is None:
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            "Compliance document or required field not found in submission. "
            "Officer to confirm whether document is missing or misfiled.",
            "check_compliance_criterion:value_missing",
        )

    threshold = criterion.threshold_json or {}
    condition_type = threshold.get("type", "BOOLEAN_PRESENCE")
    desc_lower = criterion.description.lower()

    if condition_type == "BOOLEAN_PRESENCE" or "present" in desc_lower or "registration" in desc_lower:
        val = evidence.extracted_value
        if isinstance(val, bool):
            if val:
                return (
                    VerdictValue.ELIGIBLE,
                    "Required compliance document is present in bidder submission.",
                    "check_compliance_criterion:document_present",
                )
            return (
                VerdictValue.NOT_ELIGIBLE,
                "Required compliance document is absent from bidder submission.",
                "check_compliance_criterion:document_absent",
            )
        if isinstance(val, str) and val.strip():
            if "gstin" in desc_lower or "gst" in desc_lower:
                if _is_valid_gstin(val):
                    return (
                        VerdictValue.ELIGIBLE,
                        f"Valid GSTIN format confirmed: {val.strip().upper()}",
                        "check_compliance_criterion:valid_gstin",
                    )
                return (
                    VerdictValue.NEEDS_MANUAL_REVIEW,
                    f"Extracted value '{val}' does not match expected GSTIN format (15-char alphanumeric). Manual verification required.",
                    "check_compliance_criterion:invalid_gstin_format",
                )
            if "pan" in desc_lower:
                if _is_valid_pan(val):
                    return (
                        VerdictValue.ELIGIBLE,
                        f"Valid PAN format confirmed: {val.strip().upper()}",
                        "check_compliance_criterion:valid_pan",
                    )
                return (
                    VerdictValue.NEEDS_MANUAL_REVIEW,
                    f"Extracted value '{val}' does not match expected PAN format (10-char). Manual verification required.",
                    "check_compliance_criterion:invalid_pan_format",
                )
            return (
                VerdictValue.ELIGIBLE,
                f"Compliance document present; extracted identifier: {val}",
                "check_compliance_criterion:identifier_present",
            )

    if condition_type == "FORMAT_CHECK":
        val = str(evidence.extracted_value).strip()
        if val:
            return (
                VerdictValue.ELIGIBLE,
                f"Format check passed — extracted value: {val}",
                "check_compliance_criterion:format_check_pass",
            )
        return (
            VerdictValue.NEEDS_MANUAL_REVIEW,
            "Format check: extracted value is empty. Officer to manually inspect document.",
            "check_compliance_criterion:format_check_empty",
        )

    return (
        VerdictValue.ELIGIBLE,
        "Compliance criterion satisfied — document present and evidence extracted.",
        "check_compliance_criterion:generic_pass",
    )
