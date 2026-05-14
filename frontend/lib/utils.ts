import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function confidenceColor(conf: number | null | undefined): string {
  if (!conf) return "text-slate-400";
  if (conf >= 0.85) return "text-emerald-600";
  if (conf >= 0.70) return "text-amber-600";
  return "text-red-600";
}

export function confidenceBg(conf: number | null | undefined): string {
  if (!conf) return "bg-slate-100";
  if (conf >= 0.85) return "bg-emerald-50";
  if (conf >= 0.70) return "bg-amber-50";
  return "bg-red-50";
}

export function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    ELIGIBLE: "Eligible",
    NOT_ELIGIBLE: "Not Eligible",
    NEEDS_MANUAL_REVIEW: "Needs Review",
    PENDING: "Pending",
  };
  return map[v] ?? v;
}

export function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    FINANCIAL: "Financial",
    TECHNICAL: "Technical",
    COMPLIANCE: "Compliance",
    COMPLETENESS: "Completeness",
  };
  return map[c] ?? c;
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const RULE_NAME_MAP: Record<string, string> = {
  "check_financial_criterion:meets_threshold":              "Financial Threshold Met",
  "check_financial_criterion:below_threshold":              "Financial Threshold Not Met",
  "check_financial_criterion:near_threshold_low_confidence":"Financial Threshold Borderline — Verify Manually",
  "check_financial_criterion:value_missing":                "Financial Evidence Not Found",
  "check_financial_criterion:low_confidence":               "Low OCR Confidence — Financial Review",
  "check_financial_criterion:no_threshold":                 "No Numeric Threshold — Presence Verified",
  "check_financial_criterion:normalisation_error":          "Currency Normalisation Error",
  "check_financial_criterion:within_maximum":               "Within Maximum Financial Limit",
  "check_financial_criterion:exceeds_maximum":              "Exceeds Maximum Financial Limit",
  "check_financial_criterion:generic_pass":                 "Financial Criterion Passed",
  "check_technical_criterion:count_meets_threshold":        "Experience Count Sufficient",
  "check_technical_criterion:count_below_threshold":        "Experience Count Insufficient",
  "check_technical_criterion:count_parse_error":            "Experience Count — Parse Error",
  "check_technical_criterion:value_missing":                "Technical Evidence Not Found",
  "check_technical_criterion:low_confidence":               "Low OCR Confidence — Technical Review",
  "check_technical_criterion:certificate_valid":            "Certificate Valid",
  "check_technical_criterion:certificate_expired":          "Certificate Expired",
  "check_technical_criterion:expiry_imminent":              "Certificate Expiry Imminent",
  "check_technical_criterion:date_parse_error":             "Certificate Date — Parse Error",
  "check_technical_criterion:experience_sufficient":        "Experience Duration Sufficient",
  "check_technical_criterion:experience_insufficient":      "Experience Duration Insufficient",
  "check_technical_criterion:generic_pass":                 "Technical Criterion Passed",
  "check_compliance_criterion:document_present":            "Compliance Document Present",
  "check_compliance_criterion:document_absent":             "Compliance Document Missing",
  "check_compliance_criterion:valid_gstin":                 "GSTIN Format Valid",
  "check_compliance_criterion:invalid_gstin_format":        "GSTIN Format Invalid",
  "check_compliance_criterion:valid_pan":                   "PAN Format Valid",
  "check_compliance_criterion:invalid_pan_format":          "PAN Format Invalid",
  "check_compliance_criterion:identifier_present":          "Compliance Identifier Found",
  "check_compliance_criterion:format_check_pass":           "Format Check Passed",
  "check_compliance_criterion:format_check_empty":          "Format Check — No Value Found",
  "check_compliance_criterion:value_missing":               "Compliance Document Not Found",
  "check_compliance_criterion:low_confidence":              "Low OCR Confidence — Compliance Review",
  "check_compliance_criterion:generic_pass":                "Compliance Criterion Passed",
  "unknown_category":                                       "Unknown Rule Category",
};

export function getRuleDisplayName(rule: string | null | undefined): string {
  if (!rule) return "—";
  return RULE_NAME_MAP[rule] ?? rule.replace(/_/g, " ").replace(/check_|_criterion/g, "");
}
