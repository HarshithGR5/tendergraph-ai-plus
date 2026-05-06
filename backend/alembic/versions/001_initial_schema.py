"""Initial schema — all TenderGraph AI+ tables

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200)),
        sa.Column("role", sa.String(50), nullable=False, default="PROCUREMENT_OFFICER"),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "tenders",
        sa.Column("tender_id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("issuing_authority", sa.String(300)),
        sa.Column("nit_number", sa.String(100)),
        sa.Column("closing_date", sa.DateTime),
        sa.Column("emd_amount", sa.Float),
        sa.Column("bid_validity_days", sa.Integer),
        sa.Column("status", sa.String(50), nullable=False, default="UPLOADING"),
        sa.Column("officer_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("storage_path", sa.String(500)),
        sa.Column("original_filename", sa.String(300)),
        sa.Column("file_type", sa.String(20)),
        sa.Column("ocr_status", sa.String(20), default="PENDING"),
        sa.Column("processing_job_id", sa.String(100)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "tender_criteria",
        sa.Column("criterion_id", sa.String(36), primary_key=True),
        sa.Column("tender_id", sa.String(36), sa.ForeignKey("tenders.tender_id"), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("mandatory_status", sa.String(30), default="MANDATORY"),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("threshold_json", sa.JSON),
        sa.Column("required_document", sa.Text),
        sa.Column("source_clause", sa.String(50)),
        sa.Column("source_page", sa.Integer),
        sa.Column("extraction_confidence", sa.Float, default=0.0),
        sa.Column("ambiguity_flags", sa.JSON),
        sa.Column("is_approved", sa.Boolean, default=False),
        sa.Column("is_manually_added", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_tender_criteria_tender_id", "tender_criteria", ["tender_id"])

    op.create_table(
        "bidders",
        sa.Column("bidder_id", sa.String(36), primary_key=True),
        sa.Column("tender_id", sa.String(36), sa.ForeignKey("tenders.tender_id"), nullable=False),
        sa.Column("company_name", sa.String(500), nullable=False),
        sa.Column("gstin", sa.String(20)),
        sa.Column("pan", sa.String(15)),
        sa.Column("email", sa.String(200)),
        sa.Column("contact_name", sa.String(200)),
        sa.Column("submission_timestamp", sa.DateTime, server_default=sa.func.now()),
        sa.Column("overall_verdict", sa.String(30), default="PENDING"),
        sa.Column("processing_complete", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_bidders_tender_id", "bidders", ["tender_id"])

    op.create_table(
        "bidder_documents",
        sa.Column("doc_id", sa.String(36), primary_key=True),
        sa.Column("bidder_id", sa.String(36), sa.ForeignKey("bidders.bidder_id"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(500)),
        sa.Column("file_type", sa.String(20)),
        sa.Column("doc_category", sa.String(100)),
        sa.Column("storage_path", sa.String(500)),
        sa.Column("file_size_bytes", sa.Integer),
        sa.Column("ocr_status", sa.String(20), default="PENDING"),
        sa.Column("ocr_confidence", sa.Float),
        sa.Column("page_count", sa.Integer),
        sa.Column("extracted_text_preview", sa.Text),
        sa.Column("upload_time", sa.DateTime, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime),
    )
    op.create_index("ix_bidder_documents_bidder_id", "bidder_documents", ["bidder_id"])

    op.create_table(
        "document_chunks",
        sa.Column("chunk_id", sa.String(36), primary_key=True),
        sa.Column("doc_id", sa.String(36), sa.ForeignKey("bidder_documents.doc_id"), nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("page_number", sa.Integer),
        sa.Column("chunk_index", sa.Integer),
        sa.Column("token_count", sa.Integer),
        sa.Column("embedding_vector", sa.JSON),
        sa.Column("extraction_confidence", sa.Float, default=1.0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_document_chunks_doc_id", "document_chunks", ["doc_id"])

    op.create_table(
        "bidder_evidence",
        sa.Column("evidence_id", sa.String(36), primary_key=True),
        sa.Column("bidder_id", sa.String(36), sa.ForeignKey("bidders.bidder_id"), nullable=False),
        sa.Column("criterion_id", sa.String(36), sa.ForeignKey("tender_criteria.criterion_id"), nullable=False),
        sa.Column("source_doc_id", sa.String(36), sa.ForeignKey("bidder_documents.doc_id")),
        sa.Column("source_page", sa.Integer),
        sa.Column("extracted_text", sa.Text),
        sa.Column("extracted_value", sa.JSON),
        sa.Column("unit", sa.String(50)),
        sa.Column("reference_period", sa.JSON),
        sa.Column("extraction_notes", sa.Text),
        sa.Column("ocr_confidence", sa.Float),
        sa.Column("extraction_confidence", sa.Float),
        sa.Column("extracted_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_bidder_evidence_bidder_id", "bidder_evidence", ["bidder_id"])
    op.create_index("ix_bidder_evidence_criterion_id", "bidder_evidence", ["criterion_id"])

    op.create_table(
        "criterion_verdicts",
        sa.Column("verdict_id", sa.String(36), primary_key=True),
        sa.Column("bidder_id", sa.String(36), sa.ForeignKey("bidders.bidder_id"), nullable=False),
        sa.Column("criterion_id", sa.String(36), sa.ForeignKey("tender_criteria.criterion_id"), nullable=False),
        sa.Column("evidence_id", sa.String(36), sa.ForeignKey("bidder_evidence.evidence_id")),
        sa.Column("verdict", sa.String(30), nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("rule_applied", sa.String(200)),
        sa.Column("confidence", sa.Float),
        sa.Column("decided_by", sa.String(100), default="RULE_ENGINE"),
        sa.Column("decided_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("human_reviewed", sa.Boolean, default=False),
        sa.Column("override_verdict", sa.String(30)),
        sa.Column("override_reason", sa.Text),
        sa.Column("override_officer_id", sa.String(36), sa.ForeignKey("users.user_id")),
        sa.Column("override_at", sa.DateTime),
        sa.UniqueConstraint("bidder_id", "criterion_id", name="uq_bidder_criterion_verdict"),
    )
    op.create_index("ix_criterion_verdicts_bidder_id", "criterion_verdicts", ["bidder_id"])

    op.create_table(
        "audit_events",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("tender_id", sa.String(36), sa.ForeignKey("tenders.tender_id")),
        sa.Column("bidder_id", sa.String(36), sa.ForeignKey("bidders.bidder_id")),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("actor_type", sa.String(50), default="SYSTEM"),
        sa.Column("payload_json", sa.JSON),
        sa.Column("prev_hash", sa.String(64)),
        sa.Column("hash", sa.String(64), nullable=False, unique=True),
        sa.Column("timestamp", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_events_tender_id", "audit_events", ["tender_id"])
    op.create_index("ix_audit_events_timestamp", "audit_events", ["timestamp"])

    op.create_table(
        "review_tasks",
        sa.Column("task_id", sa.String(36), primary_key=True),
        sa.Column("criterion_verdict_id", sa.String(36), sa.ForeignKey("criterion_verdicts.verdict_id"), nullable=False),
        sa.Column("bidder_id", sa.String(36), sa.ForeignKey("bidders.bidder_id"), nullable=False),
        sa.Column("assigned_to", sa.String(36), sa.ForeignKey("users.user_id")),
        sa.Column("assigned_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("reason_for_review", sa.Text, nullable=False),
        sa.Column("trigger_condition", sa.String(200)),
        sa.Column("status", sa.String(20), default="OPEN"),
        sa.Column("priority", sa.Integer, default=5),
        sa.Column("completed_at", sa.DateTime),
        sa.Column("resolution_notes", sa.Text),
        sa.Column("resolution_verdict", sa.String(30)),
        sa.Column("resolved_by", sa.String(36)),
    )
    op.create_index("ix_review_tasks_bidder_id", "review_tasks", ["bidder_id"])

    op.create_table(
        "evaluation_reports",
        sa.Column("report_id", sa.String(36), primary_key=True),
        sa.Column("tender_id", sa.String(36), sa.ForeignKey("tenders.tender_id"), nullable=False),
        sa.Column("generated_by", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("generated_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("signed_by", sa.String(36)),
        sa.Column("signed_at", sa.DateTime),
        sa.Column("report_path", sa.String(500)),
        sa.Column("report_hash", sa.String(64)),
        sa.Column("report_type", sa.String(20), default="PDF"),
        sa.Column("summary_json", sa.JSON),
    )


def downgrade() -> None:
    op.drop_table("evaluation_reports")
    op.drop_table("review_tasks")
    op.drop_table("audit_events")
    op.drop_table("criterion_verdicts")
    op.drop_table("bidder_evidence")
    op.drop_table("document_chunks")
    op.drop_table("bidder_documents")
    op.drop_table("bidders")
    op.drop_table("tender_criteria")
    op.drop_table("tenders")
    op.drop_table("users")
