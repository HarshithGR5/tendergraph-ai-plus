import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Float, Boolean, Integer, DateTime,
    ForeignKey, JSON, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from backend.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class TenderStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    PROCESSING = "PROCESSING"
    CRITERIA_EXTRACTED = "CRITERIA_EXTRACTED"
    CRITERIA_APPROVED = "CRITERIA_APPROVED"
    EVALUATION_IN_PROGRESS = "EVALUATION_IN_PROGRESS"
    EVALUATION_COMPLETE = "EVALUATION_COMPLETE"
    REPORT_GENERATED = "REPORT_GENERATED"


class CriterionCategory(str, enum.Enum):
    FINANCIAL = "FINANCIAL"
    TECHNICAL = "TECHNICAL"
    COMPLIANCE = "COMPLIANCE"
    COMPLETENESS = "COMPLETENESS"


class MandatoryStatus(str, enum.Enum):
    MANDATORY = "MANDATORY"
    OPTIONAL_PREFERRED = "OPTIONAL_PREFERRED"
    OPTIONAL_SCORED = "OPTIONAL_SCORED"
    CONDITIONAL = "CONDITIONAL"


class OCRStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class VerdictValue(str, enum.Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"


class OverallVerdict(str, enum.Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
    PENDING = "PENDING"


class ReviewTaskStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class AuditEventType(str, enum.Enum):
    CRITERION_EXTRACTED = "CRITERION_EXTRACTED"
    EVIDENCE_EXTRACTED = "EVIDENCE_EXTRACTED"
    VERDICT_EMITTED = "VERDICT_EMITTED"
    HUMAN_REVIEW_ASSIGNED = "HUMAN_REVIEW_ASSIGNED"
    HUMAN_OVERRIDE_APPLIED = "HUMAN_OVERRIDE_APPLIED"
    REPORT_EXPORTED = "REPORT_EXPORTED"
    USER_LOGIN = "USER_LOGIN"
    CRITERION_SCHEMA_APPROVED = "CRITERION_SCHEMA_APPROVED"
    TENDER_UPLOADED = "TENDER_UPLOADED"
    TENDER_DELETED = "TENDER_DELETED"
    BIDDER_UPLOADED = "BIDDER_UPLOADED"
    BIDDER_REGISTERED = "BIDDER_REGISTERED"
    OCR_COMPLETED = "OCR_COMPLETED"
    BIDDER_DOC_VIEWED = "BIDDER_DOC_VIEWED"
    DOCUMENT_DELETED = "DOCUMENT_DELETED"
    SUBMISSION_CONFIRMED = "SUBMISSION_CONFIRMED"
    KYC_COMPLETED = "KYC_COMPLETED"


class UserRole(str, enum.Enum):
    PROCUREMENT_OFFICER = "PROCUREMENT_OFFICER"
    SENIOR_OFFICER = "SENIOR_OFFICER"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    AUDIT_REVIEWER = "AUDIT_REVIEWER"
    BIDDER = "BIDDER"


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=gen_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200))
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.PROCUREMENT_OFFICER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenders = relationship("Tender", back_populates="officer", foreign_keys="Tender.officer_id")
    review_tasks = relationship("ReviewTask", back_populates="assigned_user")
    bidder_profile = relationship("Bidder", back_populates="user_account", foreign_keys="Bidder.user_id", uselist=False)


class Tender(Base):
    __tablename__ = "tenders"

    tender_id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(500), nullable=False)
    issuing_authority = Column(String(300))
    nit_number = Column(String(100))
    closing_date = Column(DateTime)
    emd_amount = Column(Float)
    bid_validity_days = Column(Integer)
    status = Column(SAEnum(TenderStatus), default=TenderStatus.UPLOADING, nullable=False)
    officer_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    storage_path = Column(String(500))
    original_filename = Column(String(300))
    file_type = Column(String(20))
    ocr_status = Column(SAEnum(OCRStatus), default=OCRStatus.PENDING)
    processing_job_id = Column(String(100))
    # Password gate for viewing bidder applications
    view_password_hash = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    officer = relationship("User", back_populates="tenders", foreign_keys=[officer_id])
    criteria = relationship("TenderCriterion", back_populates="tender", cascade="all, delete-orphan")
    bidders = relationship("Bidder", back_populates="tender", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="tender")
    reports = relationship("EvaluationReport", back_populates="tender")


class TenderCriterion(Base):
    __tablename__ = "tender_criteria"

    criterion_id = Column(String(36), primary_key=True, default=gen_uuid)
    tender_id = Column(String(36), ForeignKey("tenders.tender_id"), nullable=False)
    category = Column(SAEnum(CriterionCategory), nullable=False)
    mandatory_status = Column(SAEnum(MandatoryStatus), default=MandatoryStatus.MANDATORY)
    description = Column(Text, nullable=False)
    threshold_json = Column(JSON)
    required_document = Column(Text)
    source_clause = Column(String(50))
    source_page = Column(Integer)
    extraction_confidence = Column(Float, default=0.0)
    ambiguity_flags = Column(JSON, default=list)
    is_approved = Column(Boolean, default=False)
    is_manually_added = Column(Boolean, default=False)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tender = relationship("Tender", back_populates="criteria")
    verdicts = relationship("CriterionVerdict", back_populates="criterion")
    evidence_records = relationship("BidderEvidence", back_populates="criterion")


class Bidder(Base):
    __tablename__ = "bidders"

    bidder_id = Column(String(36), primary_key=True, default=gen_uuid)
    tender_id = Column(String(36), ForeignKey("tenders.tender_id"), nullable=False)
    # Link to the BIDDER role user account (optional — set when bidder self-registers)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    company_name = Column(String(500), nullable=False)
    gstin = Column(String(20))
    pan = Column(String(15))
    email = Column(String(200))
    contact_name = Column(String(200))
    submission_timestamp = Column(DateTime, default=datetime.utcnow)
    overall_verdict = Column(SAEnum(OverallVerdict), default=OverallVerdict.PENDING)
    processing_complete = Column(Boolean, default=False)
    submission_confirmed = Column(Boolean, default=False)
    submission_confirmed_at = Column(DateTime)
    kyc_status = Column(String(10))
    kyc_run_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    tender = relationship("Tender", back_populates="bidders")
    user_account = relationship("User", back_populates="bidder_profile", foreign_keys=[user_id])
    documents = relationship("BidderDocument", back_populates="bidder", cascade="all, delete-orphan")
    evidence_records = relationship("BidderEvidence", back_populates="bidder")
    verdicts = relationship("CriterionVerdict", back_populates="bidder")
    review_tasks = relationship("ReviewTask", back_populates="bidder")
    audit_events = relationship("AuditEvent", back_populates="bidder")


class BidderDocument(Base):
    __tablename__ = "bidder_documents"

    doc_id = Column(String(36), primary_key=True, default=gen_uuid)
    bidder_id = Column(String(36), ForeignKey("bidders.bidder_id"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    file_type = Column(String(20))
    doc_category = Column(String(100))
    storage_path = Column(String(500))
    file_size_bytes = Column(Integer)
    ocr_status = Column(SAEnum(OCRStatus), default=OCRStatus.PENDING)
    ocr_confidence = Column(Float)
    page_count = Column(Integer)
    extracted_text_preview = Column(Text)
    upload_time = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    # Uploaded by — tracks which user uploaded (must be the bidder's own account)
    uploaded_by = Column(String(36), ForeignKey("users.user_id"), nullable=True)

    bidder = relationship("Bidder", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    evidence_records = relationship("BidderEvidence", back_populates="source_document")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    chunk_id = Column(String(36), primary_key=True, default=gen_uuid)
    doc_id = Column(String(36), ForeignKey("bidder_documents.doc_id"), nullable=False)
    chunk_text = Column(Text, nullable=False)
    page_number = Column(Integer)
    chunk_index = Column(Integer)
    token_count = Column(Integer)
    embedding_vector = Column(JSON)
    extraction_confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("BidderDocument", back_populates="chunks")


class BidderEvidence(Base):
    __tablename__ = "bidder_evidence"

    evidence_id = Column(String(36), primary_key=True, default=gen_uuid)
    bidder_id = Column(String(36), ForeignKey("bidders.bidder_id"), nullable=False)
    criterion_id = Column(String(36), ForeignKey("tender_criteria.criterion_id"), nullable=False)
    source_doc_id = Column(String(36), ForeignKey("bidder_documents.doc_id"))
    source_page = Column(Integer)
    extracted_text = Column(Text)
    extracted_value = Column(JSON)
    unit = Column(String(50))
    reference_period = Column(JSON)
    extraction_notes = Column(Text)
    ocr_confidence = Column(Float)
    extraction_confidence = Column(Float)
    extracted_at = Column(DateTime, default=datetime.utcnow)

    bidder = relationship("Bidder", back_populates="evidence_records")
    criterion = relationship("TenderCriterion", back_populates="evidence_records")
    source_document = relationship("BidderDocument", back_populates="evidence_records")
    verdict = relationship("CriterionVerdict", back_populates="evidence", uselist=False)


class CriterionVerdict(Base):
    __tablename__ = "criterion_verdicts"

    verdict_id = Column(String(36), primary_key=True, default=gen_uuid)
    bidder_id = Column(String(36), ForeignKey("bidders.bidder_id"), nullable=False)
    criterion_id = Column(String(36), ForeignKey("tender_criteria.criterion_id"), nullable=False)
    evidence_id = Column(String(36), ForeignKey("bidder_evidence.evidence_id"))
    verdict = Column(SAEnum(VerdictValue), nullable=False)
    reason = Column(Text, nullable=False)
    rule_applied = Column(String(200))
    confidence = Column(Float)
    decided_by = Column(String(100), default="RULE_ENGINE")
    decided_at = Column(DateTime, default=datetime.utcnow)
    human_reviewed = Column(Boolean, default=False)
    override_verdict = Column(SAEnum(VerdictValue))
    override_reason = Column(Text)
    override_officer_id = Column(String(36), ForeignKey("users.user_id"))
    override_at = Column(DateTime)

    __table_args__ = (
        UniqueConstraint("bidder_id", "criterion_id", name="uq_bidder_criterion_verdict"),
    )

    bidder = relationship("Bidder", back_populates="verdicts")
    criterion = relationship("TenderCriterion", back_populates="verdicts")
    evidence = relationship("BidderEvidence", back_populates="verdict")
    review_task = relationship("ReviewTask", back_populates="verdict", uselist=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    event_id = Column(String(36), primary_key=True, default=gen_uuid)
    event_type = Column(SAEnum(AuditEventType), nullable=False)
    tender_id = Column(String(36), ForeignKey("tenders.tender_id"))
    bidder_id = Column(String(36), ForeignKey("bidders.bidder_id"))
    actor_id = Column(String(36), nullable=False)
    actor_type = Column(String(50), default="SYSTEM")
    payload_json = Column(JSON)
    prev_hash = Column(String(64))
    hash = Column(String(64), nullable=False, unique=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    tender = relationship("Tender", back_populates="audit_events")
    bidder = relationship("Bidder", back_populates="audit_events")


class ReviewTask(Base):
    __tablename__ = "review_tasks"

    task_id = Column(String(36), primary_key=True, default=gen_uuid)
    criterion_verdict_id = Column(String(36), ForeignKey("criterion_verdicts.verdict_id"), nullable=False)
    bidder_id = Column(String(36), ForeignKey("bidders.bidder_id"), nullable=False)
    assigned_to = Column(String(36), ForeignKey("users.user_id"))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    reason_for_review = Column(Text, nullable=False)
    trigger_condition = Column(String(200))
    status = Column(SAEnum(ReviewTaskStatus), default=ReviewTaskStatus.OPEN)
    priority = Column(Integer, default=5)
    completed_at = Column(DateTime)
    resolution_notes = Column(Text)
    resolution_verdict = Column(SAEnum(VerdictValue))
    resolved_by = Column(String(36))

    verdict = relationship("CriterionVerdict", back_populates="review_task")
    bidder = relationship("Bidder", back_populates="review_tasks")
    assigned_user = relationship("User", back_populates="review_tasks")


class EvaluationReport(Base):
    __tablename__ = "evaluation_reports"

    report_id = Column(String(36), primary_key=True, default=gen_uuid)
    tender_id = Column(String(36), ForeignKey("tenders.tender_id"), nullable=False)
    generated_by = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    signed_by = Column(String(36))
    signed_at = Column(DateTime)
    report_path = Column(String(500))
    report_hash = Column(String(64))
    report_type = Column(String(20), default="PDF")
    summary_json = Column(JSON)

    tender = relationship("Tender", back_populates="reports")
