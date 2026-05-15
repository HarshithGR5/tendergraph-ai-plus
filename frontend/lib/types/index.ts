export type UserRole = "PROCUREMENT_OFFICER" | "SENIOR_OFFICER" | "SYSTEM_ADMIN" | "AUDIT_REVIEWER" | "BIDDER";

export interface User {
  user_id: string;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
  full_name: string | null;
}

export type TenderStatus =
  | "UPLOADING" | "PROCESSING" | "CRITERIA_EXTRACTED"
  | "CRITERIA_APPROVED" | "EVALUATION_IN_PROGRESS"
  | "EVALUATION_COMPLETE" | "REPORT_GENERATED";

export type OCRStatus = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";

export interface Tender {
  tender_id: string;
  title: string;
  issuing_authority: string | null;
  nit_number: string | null;
  closing_date: string | null;
  emd_amount: number | null;
  status: TenderStatus;
  officer_id: string;
  original_filename: string | null;
  ocr_status: OCRStatus | null;
  created_at: string;
  updated_at: string;
  criteria_count: number;
  has_view_password: boolean;
}

export type CriterionCategory = "FINANCIAL" | "TECHNICAL" | "COMPLIANCE" | "COMPLETENESS";
export type MandatoryStatus = "MANDATORY" | "OPTIONAL_PREFERRED" | "OPTIONAL_SCORED" | "CONDITIONAL";

export interface ThresholdJson {
  type: string;
  value: number | null;
  unit: string;
  condition?: string;
}

export interface TenderCriterion {
  criterion_id: string;
  tender_id: string;
  category: CriterionCategory;
  mandatory_status: MandatoryStatus;
  description: string;
  threshold_json: ThresholdJson | null;
  required_document: string | null;
  source_clause: string | null;
  source_page: number | null;
  extraction_confidence: number | null;
  ambiguity_flags: string[];
  is_approved: boolean;
  is_manually_added: boolean;
  reviewer_notes: string | null;
  created_at: string;
}

export type OverallVerdict = "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_MANUAL_REVIEW" | "PENDING";
export type VerdictValue = "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_MANUAL_REVIEW";

export interface Bidder {
  bidder_id: string;
  tender_id: string;
  company_name: string;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  contact_name: string | null;
  overall_verdict: OverallVerdict;
  processing_complete: boolean;
  submission_confirmed: boolean;
  kyc_status: "PASS" | "FAIL" | "REVIEW" | null;
  submission_timestamp: string;
  document_count: number;
}

export interface BidderSubmission {
  bidder_id: string;
  tender_id: string;
  tender_title: string | null;
  company_name: string;
  gstin: string | null;
  overall_verdict: OverallVerdict;
  processing_complete: boolean;
  submission_timestamp: string;
  document_count: number;
}

export interface BidderDocument {
  doc_id: string;
  bidder_id: string;
  filename: string;
  original_filename: string | null;
  file_type: string | null;
  doc_category: string | null;
  ocr_status: OCRStatus;
  ocr_confidence: number | null;
  page_count: number | null;
  upload_time: string;
}

export interface BidderEvidence {
  evidence_id: string;
  bidder_id: string;
  criterion_id: string;
  source_doc_id: string | null;
  source_page: number | null;
  extracted_text: string | null;
  extracted_value: unknown;
  unit: string | null;
  reference_period: Record<string, unknown> | null;
  extraction_notes: string | null;
  ocr_confidence: number | null;
  extraction_confidence: number | null;
  extracted_at: string;
}

export interface CriterionVerdict {
  verdict_id: string;
  bidder_id: string;
  criterion_id: string;
  evidence_id: string | null;
  verdict: VerdictValue;
  reason: string;
  rule_applied: string | null;
  confidence: number | null;
  decided_by: string;
  decided_at: string;
  human_reviewed: boolean;
  override_verdict: VerdictValue | null;
  override_reason: string | null;
  override_at: string | null;
}

export interface BidderMatrixRow {
  bidder_id: string;
  company_name: string;
  overall_verdict: OverallVerdict;
  criteria_verdicts: CriterionVerdict[];
  kyc_status: "PASS" | "FAIL" | "REVIEW" | null;
  gstin: string | null;
  pan: string | null;
}

export interface BidderVerdictDetail {
  criterion_id: string;
  criterion_description: string | null;
  criterion_category: string | null;
  verdict: VerdictValue;
  effective_verdict: VerdictValue;
  reason: string;
  confidence: number | null;
}

export type ReviewTaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";

export interface ReviewTask {
  task_id: string;
  criterion_verdict_id: string;
  bidder_id: string;
  company_name: string | null;
  criterion_description: string | null;
  assigned_to: string | null;
  assigned_at: string;
  reason_for_review: string;
  trigger_condition: string | null;
  status: ReviewTaskStatus;
  priority: number;
  completed_at: string | null;
  resolution_notes: string | null;
  resolution_verdict: VerdictValue | null;
  evidence_source_doc_name: string | null;
  evidence_source_page: number | null;
  evidence_extracted_text: string | null;
  evidence_ocr_confidence: number | null;
  evidence_extraction_confidence: number | null;
}

export interface GlobalReviewTask extends ReviewTask {
  tender_id: string | null;
  tender_title: string | null;
}

export type AuditEventType =
  | "CRITERION_EXTRACTED" | "EVIDENCE_EXTRACTED" | "VERDICT_EMITTED"
  | "HUMAN_REVIEW_ASSIGNED" | "HUMAN_OVERRIDE_APPLIED" | "REPORT_EXPORTED"
  | "USER_LOGIN" | "CRITERION_SCHEMA_APPROVED" | "TENDER_UPLOADED" | "TENDER_DELETED"
  | "BIDDER_UPLOADED" | "BIDDER_REGISTERED" | "OCR_COMPLETED" | "BIDDER_DOC_VIEWED"
  | "DOCUMENT_DELETED";

export interface KYCCheckResult {
  valid_format: boolean;
  status: string;
  legal_name?: string | null;
  name?: string | null;
  state?: string | null;
  registration_date?: string | null;
  business_type?: string | null;
  entity_type?: string | null;
  source: string;
  error?: string | null;
  debarred?: boolean;
  reason?: string | null;
  order_date?: string | null;
  expires?: string | null;
  authority?: string | null;
  mca_status?: string;
}

export interface KYCResult {
  overall_kyc_status: "PASS" | "FAIL" | "REVIEW";
  gstin_check: KYCCheckResult | null;
  pan_check: KYCCheckResult | null;
  debarment_check: KYCCheckResult;
  company_status: KYCCheckResult;
  issues: string[];
  sandbox_mode: boolean;
}

export interface AuditEvent {
  event_id: string;
  event_type: AuditEventType;
  tender_id: string | null;
  bidder_id: string | null;
  actor_id: string;
  actor_type: string;
  payload_json: Record<string, unknown> | null;
  prev_hash: string | null;
  hash: string;
  timestamp: string;
}

export interface ChainVerification {
  valid: boolean;
  event_count: number;
  broken_at: string | null;
  broken_at_timestamp: string | null;
}

export interface EvaluationReport {
  report_id: string;
  tender_id: string;
  generated_by: string;
  generated_at: string;
  report_path: string | null;
  report_hash: string | null;
  report_type: string;
  summary_json: {
    total_bidders: number;
    eligible: number;
    not_eligible: number;
    needs_review: number;
    pending: number;
  } | null;
}
