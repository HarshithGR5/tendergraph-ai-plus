import hashlib
import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.config import settings
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, Bidder, EvaluationReport, MandatoryStatus,
    OverallVerdict, Tender, User, VerdictValue
)
from backend.services import audit_service

router = APIRouter(prefix="/tenders/{tender_id}/reports", tags=["reports"])

VERDICT_COLORS = {
    VerdictValue.ELIGIBLE: colors.HexColor("#16a34a"),
    VerdictValue.NOT_ELIGIBLE: colors.HexColor("#dc2626"),
    VerdictValue.NEEDS_MANUAL_REVIEW: colors.HexColor("#d97706"),
}

OVERALL_COLORS = {
    OverallVerdict.ELIGIBLE: colors.HexColor("#16a34a"),
    OverallVerdict.NOT_ELIGIBLE: colors.HexColor("#dc2626"),
    OverallVerdict.NEEDS_MANUAL_REVIEW: colors.HexColor("#d97706"),
    OverallVerdict.PENDING: colors.HexColor("#6b7280"),
}


class ReportOut(BaseModel):
    report_id: str
    tender_id: str
    generated_by: str
    generated_at: datetime
    report_path: Optional[str]
    report_hash: Optional[str]
    report_type: str
    summary_json: Optional[dict]

    class Config:
        from_attributes = True


def _generate_pdf(tender: Tender) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=16, spaceAfter=6, textColor=colors.HexColor("#1e3a5f"))
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=12)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=12, spaceAfter=4, textColor=colors.HexColor("#1e3a5f"))
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9, spaceAfter=4)

    story.append(Paragraph("TenderGraph AI+", title_style))
    story.append(Paragraph("AI-Powered Tender Evaluation Report", subtitle_style))
    story.append(Spacer(1, 0.3*cm))

    tender_info = [
        ["Tender Title", tender.title or "N/A"],
        ["Issuing Authority", tender.issuing_authority or "N/A"],
        ["NIT Number", tender.nit_number or "N/A"],
        ["Closing Date", tender.closing_date.strftime("%d %b %Y") if tender.closing_date else "N/A"],
        ["Report Generated", datetime.utcnow().strftime("%d %b %Y %H:%M UTC")],
        ["Total Bidders", str(len(tender.bidders))],
        ["Total Criteria", str(len([c for c in tender.criteria if c.is_approved]))],
    ]
    t = Table(tender_info, colWidths=[5*cm, 12*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Executive Summary", heading_style))
    approved_criteria = [c for c in tender.criteria if c.is_approved]
    mandatory_criteria = [c for c in approved_criteria if c.mandatory_status == MandatoryStatus.MANDATORY]
    eligible_count = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.ELIGIBLE)
    not_eligible_count = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NOT_ELIGIBLE)
    review_count = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NEEDS_MANUAL_REVIEW)
    pending_count = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.PENDING)

    summary_data = [
        ["Metric", "Count"],
        ["Total Bidders Evaluated", str(len(tender.bidders))],
        ["Eligible", str(eligible_count)],
        ["Not Eligible", str(not_eligible_count)],
        ["Requires Manual Review", str(review_count)],
        ["Pending Evaluation", str(pending_count)],
        ["Total Criteria (Approved)", str(len(approved_criteria))],
        ["Mandatory Criteria", str(len(mandatory_criteria))],
    ]
    t2 = Table(summary_data, colWidths=[10*cm, 7*cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t2)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Bidder Evaluation Matrix", heading_style))
    header = ["Bidder", "Overall"] + [f"C{i+1}" for i in range(len(approved_criteria))]
    matrix_data = [header]
    for bidder in tender.bidders:
        row = [bidder.company_name[:30], bidder.overall_verdict.value]
        for criterion in approved_criteria:
            verdict = next((v for v in bidder.verdicts if v.criterion_id == criterion.criterion_id), None)
            if verdict:
                effective = (verdict.override_verdict or verdict.verdict).value
                row.append(effective[:3])
            else:
                row.append("-")
        matrix_data.append(row)

    col_widths = [5*cm, 2.5*cm] + [1.5*cm] * len(approved_criteria)
    total_width = sum(col_widths)
    if total_width > 17*cm:
        scale = 17*cm / total_width
        col_widths = [w * scale for w in col_widths]

    t3 = Table(matrix_data, colWidths=col_widths)
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
    ]))
    story.append(t3)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Criterion-Level Evidence Summary", heading_style))
    for bidder in tender.bidders:
        story.append(Paragraph(f"Bidder: {bidder.company_name} — {bidder.overall_verdict.value}", ParagraphStyle("BidderName", parent=styles["Heading3"], fontSize=10)))
        for verdict in bidder.verdicts:
            eff_verdict = verdict.override_verdict or verdict.verdict
            story.append(Paragraph(
                f"  [{eff_verdict.value}] {verdict.criterion.description[:100]} — {verdict.reason[:200]}",
                body_style
            ))
        story.append(Spacer(1, 0.2*cm))

    story.append(Paragraph("Audit Declaration", heading_style))
    story.append(Paragraph(
        "This report is generated by TenderGraph AI+ and represents the output of an automated, "
        "rule-based eligibility evaluation system. All automated verdicts are based on structured "
        "evidence extracted from bidder-submitted documents. Each verdict is traceable to specific "
        "document pages and clauses. This report does not constitute the final procurement decision "
        "and must be reviewed and signed off by an authorised Procurement Officer.",
        body_style,
    ))

    doc.build(story)
    return buffer.getvalue()


@router.post("/generate", response_model=ReportOut, status_code=201)
def generate_report(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    pdf_bytes = _generate_pdf(tender)
    report_hash = hashlib.sha256(pdf_bytes).hexdigest()

    report_dir = Path(settings.storage_base_path) / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_filename = f"report_{tender_id}_{uuid.uuid4().hex[:8]}.pdf"
    report_path = report_dir / report_filename
    with open(report_path, "wb") as f:
        f.write(pdf_bytes)

    summary = {
        "total_bidders": len(tender.bidders),
        "eligible": sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.ELIGIBLE),
        "not_eligible": sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NOT_ELIGIBLE),
        "needs_review": sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NEEDS_MANUAL_REVIEW),
        "pending": sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.PENDING),
    }

    report = EvaluationReport(
        tender_id=tender_id,
        generated_by=current_user.user_id,
        report_path=str(report_path),
        report_hash=report_hash,
        report_type="PDF",
        summary_json=summary,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    audit_service.log_event(
        db=db, event_type=AuditEventType.REPORT_EXPORTED,
        actor_id=current_user.user_id, actor_type="HUMAN",
        payload={"report_id": report.report_id, "report_hash": report_hash, **summary},
        tender_id=tender_id,
    )
    return report


@router.get("/{report_id}/download")
def download_report(
    tender_id: str,
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(EvaluationReport).filter(
        EvaluationReport.report_id == report_id,
        EvaluationReport.tender_id == tender_id,
    ).first()
    if not report or not report.report_path:
        raise HTTPException(status_code=404, detail="Report not found.")
    if not Path(report.report_path).exists():
        raise HTTPException(status_code=404, detail="Report file not found on disk.")
    return FileResponse(
        path=report.report_path,
        media_type="application/pdf",
        filename=f"TenderGraph_Report_{tender_id}.pdf",
    )


@router.get("/", response_model=List[ReportOut])
def list_reports(tender_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    return tender.reports
