"""
KYC (Know Your Counterparty) Sandbox Service
=============================================

Integrates three KYC checks relevant to Indian government procurement:

  1. GSTIN Verification   — GSTN API (sandbox / mock)
  2. PAN Verification     — ITD NSDL API (sandbox / mock)
  3. Debarment Check      — CVC / GEM Debarment Registry (sandbox / mock)
  4. Company Status       — MCA21 Active/Struck-off lookup (sandbox / mock)

Production integration notes
-----------------------------
  GSTIN : Replace sandbox_gstin_lookup() with a call to the official
          GSTN verification API (https://api.gstin.io or NIC GSP gateway).
          Requires GSP registration.

  PAN   : ITD provides the PAN verification API via NSDL e-Gov.
          Requires a TAN / PAN service agreement.

  MCA21 : The Ministry of Corporate Affairs exposes CIN / company-status
          APIs via the MCA Data API (data.mca.gov.in).

  Debarment : The Central Vigilance Commission publishes a debarment list
          that can be scraped or obtained via RTI.  GEM (GeM portal) has a
          REST API for registered vendors.

All sandbox responses follow the same schema as the production APIs so that
swapping in real credentials requires only changing the HTTP call, not the
business logic in rule_engine.py.
"""
import hashlib
import logging
import re
from datetime import date
from typing import Optional

from backend.services.entity_normalization import (
    normalise_gstin,
    normalise_pan,
    extract_state_from_gstin,
)

logger = logging.getLogger(__name__)

# ── Sandbox Data ───────────────────────────────────────────────────────────────
# In production, these lookups hit real government APIs.
# In sandbox mode, we use a small set of deterministic test vectors so QA
# engineers can exercise every code path without real credentials.

_SANDBOX_GSTIN_DB = {
    # Format: GSTIN → {status, legal_name, registration_date, state}
    "27AABCU9603R1ZX": {
        "status": "Active",
        "legal_name": "Example Technology Pvt Ltd",
        "registration_date": "2018-04-01",
        "state": "Maharashtra",
        "business_type": "Private Limited Company",
    },
    "29AAACR5055K1ZK": {
        "status": "Active",
        "legal_name": "Reliable Constructions Ltd",
        "registration_date": "2015-07-15",
        "state": "Karnataka",
        "business_type": "Limited Company",
    },
    "07AAKCS9349N1ZL": {
        "status": "Cancelled",
        "legal_name": "Struck Off Ventures Pvt Ltd",
        "registration_date": "2010-01-01",
        "state": "Delhi",
        "business_type": "Private Limited Company",
    },
}

_SANDBOX_PAN_DB = {
    # Format: PAN → {status, name, entity_type}
    "AABCU9603R": {"status": "Active", "name": "Example Technology Pvt Ltd", "entity_type": "Company"},
    "AAACR5055K": {"status": "Active", "name": "Reliable Constructions Ltd", "entity_type": "Company"},
    "AAKCS9349N": {"status": "Active", "name": "Struck Off Ventures Pvt Ltd", "entity_type": "Company"},
}

# Debarment list — companies barred from government procurement by CVC / MoF order
_SANDBOX_DEBARMENT_DB = {
    # Normalised company name hash → {reason, order_date, expires}
    hashlib.sha256("STRUCK OFF VENTURES".encode()).hexdigest(): {
        "debarred": True,
        "reason": "Fraudulent bid submission — CVC Order No. 12/2022",
        "order_date": "2022-03-15",
        "expires": "2027-03-15",
        "authority": "Central Vigilance Commission",
    },
    hashlib.sha256("BLACKLISTED INFRA".encode()).hexdigest(): {
        "debarred": True,
        "reason": "Contract abandonment — PWD Order 45/2021",
        "order_date": "2021-08-01",
        "expires": "2026-08-01",
        "authority": "Ministry of Road Transport",
    },
}


# ── GSTIN Verification ─────────────────────────────────────────────────────────

def verify_gstin(raw_gstin: str, sandbox: bool = True) -> dict:
    """
    Verify a GSTIN via the GSTN verification API.

    Returns a standardised response dict:
      {
        "gstin"           : str,
        "valid_format"    : bool,
        "status"          : "Active" | "Cancelled" | "Suspended" | "Unknown",
        "legal_name"      : str | None,
        "state"           : str | None,
        "registration_date": str | None,   # ISO-8601
        "business_type"   : str | None,
        "source"          : "sandbox" | "gstn_api",
        "error"           : str | None,
      }
    """
    normalised, valid_format = normalise_gstin(raw_gstin)
    base = {
        "gstin": normalised,
        "valid_format": valid_format,
        "state": extract_state_from_gstin(normalised) if valid_format else None,
        "legal_name": None,
        "registration_date": None,
        "business_type": None,
        "error": None,
    }

    if not valid_format:
        return {**base, "status": "Invalid", "source": "format_check",
                "error": "GSTIN does not match the 15-character CBIC specification."}

    if sandbox:
        record = _SANDBOX_GSTIN_DB.get(normalised)
        if record:
            return {**base, **record, "source": "sandbox"}
        # Unknown GSTIN in sandbox → treat as unverified but not invalid
        return {**base, "status": "Unverified",
                "source": "sandbox",
                "error": "GSTIN not found in sandbox registry. In production this would query GSTN API."}
    else:
        # TODO: replace with real GSTN GSP API call
        # import httpx
        # response = httpx.get(f"https://api.gstn.gov.in/verify/{normalised}",
        #                      headers={"Authorization": f"Bearer {GSTN_API_KEY}"})
        # return _parse_gstn_response(response.json())
        raise NotImplementedError("Production GSTN API not configured. Set sandbox=True or provide GSTN credentials.")


# ── PAN Verification ───────────────────────────────────────────────────────────

def verify_pan(raw_pan: str, sandbox: bool = True) -> dict:
    """
    Verify a PAN via the ITD NSDL verification API.

    Returns:
      {
        "pan"         : str,
        "valid_format": bool,
        "status"      : "Active" | "Invalid" | "Deactivated" | "Unknown",
        "name"        : str | None,
        "entity_type" : str | None,
        "source"      : "sandbox" | "itd_api",
        "error"       : str | None,
      }
    """
    normalised, valid_format = normalise_pan(raw_pan)
    base = {
        "pan": normalised,
        "valid_format": valid_format,
        "name": None,
        "entity_type": None,
        "error": None,
    }

    if not valid_format:
        return {**base, "status": "Invalid", "source": "format_check",
                "error": "PAN does not match the 10-character Income Tax Dept specification."}

    if sandbox:
        record = _SANDBOX_PAN_DB.get(normalised)
        if record:
            return {**base, **record, "source": "sandbox"}
        return {**base, "status": "Unverified",
                "source": "sandbox",
                "error": "PAN not found in sandbox registry. In production this would query ITD NSDL API."}
    else:
        raise NotImplementedError("Production ITD PAN API not configured. Set sandbox=True or provide NSDL credentials.")


# ── Debarment Check ────────────────────────────────────────────────────────────

def check_debarment(company_name: str, sandbox: bool = True) -> dict:
    """
    Check whether a company is debarred from government procurement.

    Checks against:
      - CVC debarment orders
      - MoF debarment notifications
      - GEM blacklist (sandbox simulation)

    Returns:
      {
        "company_name"    : str,
        "debarred"        : bool,
        "reason"          : str | None,
        "order_date"      : str | None,
        "expires"         : str | None,
        "authority"       : str | None,
        "source"          : "sandbox" | "cvc_api",
        "error"           : str | None,
      }
    """
    from backend.services.entity_normalization import normalise_company_name
    canonical = normalise_company_name(company_name)
    name_hash = hashlib.sha256(canonical.encode()).hexdigest()

    base = {
        "company_name": company_name,
        "canonical_name": canonical,
        "debarred": False,
        "reason": None,
        "order_date": None,
        "expires": None,
        "authority": None,
        "error": None,
    }

    if sandbox:
        record = _SANDBOX_DEBARMENT_DB.get(name_hash)
        if record:
            return {**base, **record, "source": "sandbox"}
        return {**base, "source": "sandbox"}
    else:
        raise NotImplementedError("Production CVC debarment API not configured.")


# ── Company Status (MCA21) ─────────────────────────────────────────────────────

def verify_company_status(company_name: str, cin: Optional[str] = None, sandbox: bool = True) -> dict:
    """
    Verify a company's MCA21 registration status.

    Checks:
      - Active / Struck-off / Under Liquidation / Dormant
      - Registered office address
      - Director details (count)

    Returns:
      {
        "company_name"   : str,
        "cin"            : str | None,
        "mca_status"     : "Active" | "Struck Off" | "Under Liquidation" | "Dormant" | "Unknown",
        "registered_since": str | None,
        "source"         : "sandbox" | "mca21_api",
        "error"          : str | None,
      }
    """
    from backend.services.entity_normalization import normalise_company_name
    canonical = normalise_company_name(company_name)

    base = {
        "company_name": company_name,
        "canonical_name": canonical,
        "cin": cin,
        "mca_status": "Unknown",
        "registered_since": None,
        "error": None,
    }

    if sandbox:
        # Simple heuristic: "STRUCK OFF" in the name → Struck Off
        if "STRUCK" in canonical or "CANCEL" in canonical:
            return {**base, "mca_status": "Struck Off", "source": "sandbox",
                    "error": "Company appears to be struck off. Verify via MCA21 portal."}
        return {**base, "mca_status": "Active", "source": "sandbox",
                "registered_since": "2015-01-01"}
    else:
        raise NotImplementedError("Production MCA21 API not configured.")


# ── Composite KYC Check ────────────────────────────────────────────────────────

def run_full_kyc(
    company_name: str,
    gstin: Optional[str] = None,
    pan: Optional[str] = None,
    cin: Optional[str] = None,
    sandbox: bool = True,
) -> dict:
    """
    Run all available KYC checks for a bidder and return a consolidated result.

    Returns:
      {
        "overall_kyc_status": "PASS" | "FAIL" | "REVIEW",
        "gstin_check"       : dict | None,
        "pan_check"         : dict | None,
        "debarment_check"   : dict,
        "company_status"    : dict,
        "issues"            : [str],   # human-readable list of problems found
      }
    """
    issues = []

    gstin_result = None
    if gstin:
        gstin_result = verify_gstin(gstin, sandbox=sandbox)
        if not gstin_result["valid_format"]:
            issues.append(f"GSTIN format invalid: {gstin_result.get('error')}")
        elif gstin_result["status"] not in ("Active", "Unverified"):
            issues.append(f"GSTIN is not active: status={gstin_result['status']}")

    pan_result = None
    if pan:
        pan_result = verify_pan(pan, sandbox=sandbox)
        if not pan_result["valid_format"]:
            issues.append(f"PAN format invalid: {pan_result.get('error')}")
        elif pan_result["status"] not in ("Active", "Unverified"):
            issues.append(f"PAN is not active: status={pan_result['status']}")

    debarment_result = check_debarment(company_name, sandbox=sandbox)
    if debarment_result["debarred"]:
        issues.append(
            f"Company is debarred: {debarment_result['reason']} "
            f"(expires {debarment_result.get('expires', 'N/A')})"
        )

    company_result = verify_company_status(company_name, cin=cin, sandbox=sandbox)
    if company_result["mca_status"] not in ("Active", "Unknown"):
        issues.append(f"MCA21 company status: {company_result['mca_status']}")

    # Determine overall status
    hard_fails = [i for i in issues if "debarred" in i.lower() or "struck off" in i.lower()]
    if hard_fails:
        overall = "FAIL"
    elif issues:
        overall = "REVIEW"
    else:
        overall = "PASS"

    return {
        "overall_kyc_status": overall,
        "gstin_check": gstin_result,
        "pan_check": pan_result,
        "debarment_check": debarment_result,
        "company_status": company_result,
        "issues": issues,
        "sandbox_mode": sandbox,
    }
