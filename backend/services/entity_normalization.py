"""
Entity Resolution & Normalisation Service
==========================================

Handles the "messy data" problem that is endemic to government procurement:
bidder company names, identifiers, and financial figures arrive in dozens of
inconsistent formats across submitted documents.

Responsibilities:
  1. Company Name Normalisation  — canonical form, suffix stripping, fuzzy dedup
  2. GSTIN / PAN Normalisation  — uppercase, whitespace removal, checksum validation
  3. Financial Amount Normalisation — Indian number system (Crore / Lakh / Lacs)
                                      + currency symbol stripping
  4. Date Normalisation          — 15+ common formats → ISO-8601
  5. Address Normalisation       — pin-code extraction, state normalisation

All functions are pure (no DB side-effects) and deterministic so they can be
called safely from both the sync API path and Celery workers.
"""
import re
import logging
from datetime import date, datetime
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

LAKH = 100_000
CRORE = 10_000_000

# Legal suffixes that appear after a company name in Indian corporate filings.
# Ordered longest-first to avoid partial matches.
_COMPANY_SUFFIXES = [
    r"private\s+limited",
    r"pvt\.?\s*ltd\.?",
    r"public\s+limited",
    r"limited\s+liability\s+partnership",
    r"limited",
    r"llp",
    r"ltd\.?",
    r"incorporated",
    r"inc\.?",
    r"corporation",
    r"corp\.?",
    r"co\.?\s+ltd\.?",
]
_SUFFIX_RE = re.compile(
    r"\s*[,]?\s*(?:" + "|".join(_COMPANY_SUFFIXES) + r")\s*[,.]?\s*$",
    re.IGNORECASE,
)

# Characters that are irrelevant for matching purposes
_PUNCT_RE = re.compile(r"[&@#\-_/\\()'\"]")
_SPACE_RE = re.compile(r"\s+")

# GSTIN: 15-character alphanumeric per CBIC specification
_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
# PAN: 10-character per Income Tax Dept specification
_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")

# Date formats common in Indian government documents
_DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
    "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d %b %Y", "%d %B %Y",
    "%b %d, %Y", "%B %d, %Y",
    "%d-%b-%Y", "%d-%b-%y",
]

# Map of common Indian state name abbreviations / misspellings → canonical
_STATE_MAP = {
    "mh": "Maharashtra", "maharashtra": "Maharashtra",
    "dl": "Delhi", "delhi": "Delhi", "new delhi": "Delhi",
    "ka": "Karnataka", "karnataka": "Karnataka",
    "tn": "Tamil Nadu", "tamilnadu": "Tamil Nadu", "tamil nadu": "Tamil Nadu",
    "gj": "Gujarat", "gujarat": "Gujarat",
    "up": "Uttar Pradesh", "uttar pradesh": "Uttar Pradesh",
    "wb": "West Bengal", "west bengal": "West Bengal",
    "rj": "Rajasthan", "rajasthan": "Rajasthan",
    "hr": "Haryana", "haryana": "Haryana",
    "pb": "Punjab", "punjab": "Punjab",
    "mp": "Madhya Pradesh", "madhya pradesh": "Madhya Pradesh",
    "br": "Bihar", "bihar": "Bihar",
    "od": "Odisha", "odisha": "Odisha", "orissa": "Odisha",
    "ts": "Telangana", "telangana": "Telangana",
    "ap": "Andhra Pradesh", "andhra pradesh": "Andhra Pradesh",
    "kl": "Kerala", "kerala": "Kerala",
    "as": "Assam", "assam": "Assam",
    "jh": "Jharkhand", "jharkhand": "Jharkhand",
    "uk": "Uttarakhand", "uttarakhand": "Uttarakhand",
    "hp": "Himachal Pradesh", "himachal pradesh": "Himachal Pradesh",
    "ga": "Goa", "goa": "Goa",
    "ch": "Chandigarh", "chandigarh": "Chandigarh",
    "jk": "Jammu & Kashmir", "jammu kashmir": "Jammu & Kashmir",
}


# ── Company Name Normalisation ─────────────────────────────────────────────────

def normalise_company_name(raw: str) -> str:
    """
    Produce a canonical company name for entity resolution and deduplication.

    Steps:
      1. Strip leading/trailing whitespace.
      2. Collapse internal whitespace.
      3. Strip legal suffixes (Pvt Ltd, LLP, Corp …).
      4. Remove punctuation that is irrelevant for identity matching.
      5. Uppercase.

    Examples:
      "Tata Consultancy Services Ltd."   → "TATA CONSULTANCY SERVICES"
      "T.C.S. Private Limited"           → "TCS"
      "tcs pvt. ltd"                     → "TCS"
    """
    if not raw:
        return ""
    name = raw.strip()
    name = _SPACE_RE.sub(" ", name)
    name = _SUFFIX_RE.sub("", name).strip().rstrip(",.")
    name = _PUNCT_RE.sub("", name)
    name = _SPACE_RE.sub(" ", name).strip()
    return name.upper()


def company_match_score(a: str, b: str) -> float:
    """
    Return a similarity score [0.0 – 1.0] between two company names after
    normalisation.  Uses token-level Jaccard similarity so word order does
    not matter ("Infosys Technologies Ltd" ≈ "Infosys Ltd Technologies").
    """
    norm_a = normalise_company_name(a)
    norm_b = normalise_company_name(b)
    if norm_a == norm_b:
        return 1.0
    tokens_a = set(norm_a.split())
    tokens_b = set(norm_b.split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


# ── GSTIN / PAN Normalisation ──────────────────────────────────────────────────

def normalise_gstin(raw: str) -> Tuple[str, bool]:
    """
    Normalise a GSTIN string and validate its format.

    Returns:
        (normalised_value, is_valid_format)

    Normalisation:
      - Remove all whitespace and hyphens (common OCR artefacts)
      - Uppercase

    Format check is against the CBIC 15-character specification:
      Digits 1-2   : State code (01–37)
      Chars 3-12   : PAN of the entity
      Char 13      : Entity number within state (1–9, A–Z)
      Char 14      : Z (always)
      Char 15      : Checksum digit
    """
    cleaned = re.sub(r"[\s\-]", "", (raw or "")).upper()
    return cleaned, bool(_GSTIN_RE.match(cleaned))


def normalise_pan(raw: str) -> Tuple[str, bool]:
    """
    Normalise a PAN string and validate its format.

    Returns:
        (normalised_value, is_valid_format)

    Format: AAAAA9999A  (5 alpha + 4 numeric + 1 alpha)
    """
    cleaned = re.sub(r"[\s\-\.]", "", (raw or "")).upper()
    return cleaned, bool(_PAN_RE.match(cleaned))


def extract_state_from_gstin(gstin: str) -> Optional[str]:
    """
    Decode the 2-digit state code embedded in a GSTIN to a state name.
    CBIC state codes: 01=J&K … 37=Andhra Pradesh.
    """
    _GSTIN_STATE_CODES = {
        "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
        "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
        "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
        "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
        "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
        "16": "Tripura", "17": "Meghalaya", "18": "Assam",
        "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
        "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
        "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
        "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa",
        "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
        "34": "Puducherry", "35": "Andaman & Nicobar Islands",
        "36": "Telangana", "37": "Andhra Pradesh",
    }
    normalised, valid = normalise_gstin(gstin)
    if not valid or len(normalised) < 2:
        return None
    return _GSTIN_STATE_CODES.get(normalised[:2])


# ── Financial Amount Normalisation ────────────────────────────────────────────

def normalise_to_inr(value, unit: str = "INR") -> Optional[float]:
    """
    Convert a financial amount expressed in Indian units to an absolute INR value.

    Handles:
      Crore / Cr / CR  → × 10,000,000
      Lakh / Lac / L   → × 100,000
      Million          → × 1,000,000
      Thousand / K     → × 1,000
      INR / Rs / ₹     → no conversion (already in rupees)
      USD              → approximate (1 USD ≈ 83 INR) for rough comparison only
    """
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None

    unit_upper = (unit or "INR").upper().strip()
    if re.search(r"\bCROREE?\b|\bCR\b", unit_upper):
        return v * CRORE
    if re.search(r"\bLAK?H?\b|\bLAC\b|\b^L$", unit_upper):
        return v * LAKH
    if "MILLION" in unit_upper:
        return v * 1_000_000
    if re.search(r"\bTHOUSAND\b|\bK\b", unit_upper):
        return v * 1_000
    if "USD" in unit_upper:
        return v * 83  # approximate — for ordering/comparison only
    return v  # already INR, Rs, ₹, etc.


def extract_amount_from_text(text: str) -> Optional[float]:
    """
    Parse a financial amount from a free-form string like:
      "₹ 5,00,000 (Five Lakhs)"
      "Rs. 2.5 Crore"
      "INR 50,00,000/-"
      "10 lakhs rupees"

    Returns the value in absolute INR, or None if unparseable.
    """
    if not text:
        return None
    text = text.replace(",", "").replace("₹", "").replace("Rs.", "").replace("Rs", "")
    text = text.replace("INR", "").replace("/-", "").strip()
    m = re.search(
        r"(\d+(?:\.\d+)?)\s*(crore|crores|cr\.?|lakh|lakhs|lac|lacs|million|thousand|k\b)?",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None
    num = float(m.group(1))
    unit = (m.group(2) or "INR").lower()
    if re.match(r"crore|cr", unit):
        return num * CRORE
    if re.match(r"lakh|lac", unit):
        return num * LAKH
    if "million" in unit:
        return num * 1_000_000
    if re.match(r"thousand|k", unit):
        return num * 1_000
    return num


# ── Date Normalisation ─────────────────────────────────────────────────────────

def normalise_date(raw: str) -> Optional[date]:
    """
    Parse a date string in any of the 15+ formats common in Indian government
    documents and return a Python date object (or None if unparseable).

    Handles:
      DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
      DD/MM/YY  (2-digit year → 2000-based)
      YYYY-MM-DD (ISO)
      DD Mon YYYY, DD Month YYYY
      Mon DD, YYYY
    """
    if not raw:
        return None
    raw = raw.strip()
    # Remove ordinal suffixes: 1st → 1, 22nd → 22
    raw = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", raw, flags=re.IGNORECASE)
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def is_date_valid(raw: str, reference_date: Optional[date] = None) -> Tuple[bool, Optional[str]]:
    """
    Check whether a date string parses successfully AND (if reference_date
    provided) is not before the reference date.

    Returns:
        (is_valid, reason_string_or_None)
    """
    parsed = normalise_date(raw)
    if parsed is None:
        return False, f"Could not parse date '{raw}' — format not recognised."
    if reference_date and parsed < reference_date:
        return False, f"Date {parsed.isoformat()} has expired (reference: {reference_date.isoformat()})."
    return True, None


# ── Address Normalisation ──────────────────────────────────────────────────────

def extract_pincode(address: str) -> Optional[str]:
    """Extract a 6-digit Indian PIN code from an address string."""
    m = re.search(r"\b([1-9][0-9]{5})\b", address or "")
    return m.group(1) if m else None


def normalise_state(raw: str) -> Optional[str]:
    """Map a raw state string to its canonical Indian state name."""
    if not raw:
        return None
    key = raw.strip().lower()
    return _STATE_MAP.get(key)
