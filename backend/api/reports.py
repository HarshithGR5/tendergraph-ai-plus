import hashlib
import io
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable, PageBreak,
)
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.database import get_db
from backend.models.tables import (
    AuditEventType, EvaluationReport, MandatoryStatus,
    OverallVerdict, Tender, User, VerdictValue,
)
from backend.services import audit_service

router = APIRouter(prefix="/tenders/{tender_id}/reports", tags=["reports"])

OVERALL_BG = {
    OverallVerdict.ELIGIBLE:           colors.HexColor("#dcfce7"),
    OverallVerdict.NOT_ELIGIBLE:       colors.HexColor("#fee2e2"),
    OverallVerdict.NEEDS_MANUAL_REVIEW:colors.HexColor("#fef3c7"),
    OverallVerdict.PENDING:            colors.HexColor("#f1f5f9"),
}

VERDICT_SHORT = {
    "ELIGIBLE":            "ELG",
    "NOT_ELIGIBLE":        "N/E",
    "NEEDS_MANUAL_REVIEW": "REV",
    "PENDING":             "PND",
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


def _p(text: str, style) -> Paragraph:
    safe = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe, style)


def _generate_pdf(tender: Tender) -> bytes:
    buffer = io.BytesIO()
    PAGE_W = A4[0] - 4 * cm

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
    )
    styles = getSampleStyleSheet()

    title_s  = ParagraphStyle("T",  parent=styles["Heading1"],  fontSize=18, spaceAfter=4,
                               textColor=colors.HexColor("#1e3a5f"), leading=22)
    sub_s    = ParagraphStyle("S",  parent=styles["Normal"],    fontSize=10, spaceAfter=14,
                               textColor=colors.HexColor("#64748b"))
    h2_s     = ParagraphStyle("H2", parent=styles["Heading2"],  fontSize=12, spaceBefore=14,
                               spaceAfter=6, textColor=colors.HexColor("#1e3a5f"))
    h3_s     = ParagraphStyle("H3", parent=styles["Heading3"],  fontSize=10, spaceBefore=10,
                               spaceAfter=4, textColor=colors.HexColor("#334155"))
    body_s   = ParagraphStyle("B",  parent=styles["Normal"],    fontSize=9, leading=13, spaceAfter=3)
    cell_s   = ParagraphStyle("C",  parent=styles["Normal"],    fontSize=8, leading=11)
    label_s  = ParagraphStyle("L",  parent=styles["Normal"],    fontSize=7, leading=10,
                               textColor=colors.HexColor("#64748b"))
    mono_s   = ParagraphStyle("M",  parent=styles["Normal"],    fontSize=7, leading=10,
                               fontName="Courier", textColor=colors.HexColor("#1e40af"))
    note_s   = ParagraphStyle("N",  parent=styles["Normal"],    fontSize=8, leading=12,
                               textColor=colors.HexColor("#92400e"), leftIndent=8)

    story = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story.append(_p("TenderGraph AI+", title_s))
    story.append(_p("AI-Powered Eligibility Evaluation Report — Confidential", sub_s))
    story.append(HRFlowable(width="100%", thickness=1,
                             color=colors.HexColor("#e2e8f0"), spaceAfter=10))

    # ── Tender Info ────────────────────────────────────────────────────────────
    approved_criteria = [c for c in tender.criteria if c.is_approved]
    t_rows = [
        [_p("Tender Title", label_s),       _p(tender.title or "N/A", cell_s)],
        [_p("Issuing Authority", label_s),   _p(tender.issuing_authority or "N/A", cell_s)],
        [_p("NIT / Reference No.", label_s), _p(tender.nit_number or "N/A", cell_s)],
        [_p("Closing Date", label_s),
         _p(tender.closing_date.strftime("%d %b %Y") if tender.closing_date else "N/A", cell_s)],
        [_p("Report Generated", label_s),   _p(datetime.utcnow().strftime("%d %b %Y %H:%M UTC"), cell_s)],
        [_p("Total Bidders", label_s),       _p(str(len(tender.bidders)), cell_s)],
        [_p("Approved Criteria", label_s),   _p(str(len(approved_criteria)), cell_s)],
    ]
    _tbl_style = TableStyle([
        ("BACKGROUND",    (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ])
    ti = Table(t_rows, colWidths=[4.5 * cm, PAGE_W - 4.5 * cm])
    ti.setStyle(_tbl_style)
    story.append(KeepTogether([_p("Tender Information", h2_s), ti]))
    story.append(Spacer(1, 0.4 * cm))

    # ── Executive Summary ──────────────────────────────────────────────────────
    mandatory_c   = [c for c in approved_criteria if c.mandatory_status == MandatoryStatus.MANDATORY]
    eligible_n    = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.ELIGIBLE)
    not_elig_n    = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NOT_ELIGIBLE)
    review_n      = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NEEDS_MANUAL_REVIEW)
    pending_n     = sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.PENDING)

    s_rows = [
        [_p("Metric", label_s),                     _p("Count", label_s)],
        [_p("Total Bidders", cell_s),                _p(str(len(tender.bidders)), cell_s)],
        [_p("Eligible", cell_s),                     _p(str(eligible_n), cell_s)],
        [_p("Not Eligible", cell_s),                 _p(str(not_elig_n), cell_s)],
        [_p("Requires Manual Review", cell_s),       _p(str(review_n), cell_s)],
        [_p("Pending Evaluation", cell_s),           _p(str(pending_n), cell_s)],
        [_p("Approved Criteria (Total)", cell_s),    _p(str(len(approved_criteria)), cell_s)],
        [_p("Mandatory Criteria", cell_s),           _p(str(len(mandatory_c)), cell_s)],
    ]
    es = Table(s_rows, colWidths=[PAGE_W * 0.65, PAGE_W * 0.35])
    es.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("ALIGN",         (1, 0), (1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    story.append(KeepTogether([_p("Executive Summary", h2_s), es]))

    # ── Bidder Evaluation Matrix ───────────────────────────────────────────────
    story.append(PageBreak())
    story.append(_p("Bidder Evaluation Matrix", h2_s))

    MAX_COLS = 8
    disp_criteria  = approved_criteria[:MAX_COLS]
    extra_criteria = approved_criteria[MAX_COLS:]

    # Criterion legend
    leg_rows = [[_p("Code", label_s), _p("Description", label_s),
                 _p("Category", label_s), _p("Mandatory?", label_s)]]
    for i, c in enumerate(disp_criteria):
        cat = c.category.value if hasattr(c.category, "value") else str(c.category)
        mnd = "Yes" if getattr(c.mandatory_status, "value", str(c.mandatory_status)) == "MANDATORY" else "No"
        desc = c.description[:110] + ("…" if len(c.description) > 110 else "")
        leg_rows.append([_p(f"C{i+1}", mono_s), _p(desc, cell_s), _p(cat, cell_s), _p(mnd, cell_s)])

    leg_cw = [1.2 * cm, PAGE_W - 5.4 * cm, 2.5 * cm, 1.7 * cm]
    leg_t = Table(leg_rows, colWidths=leg_cw)
    leg_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#334155")),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 7),
        ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
    ]))
    story.append(leg_t)
    story.append(Spacer(1, 0.25 * cm))

    if extra_criteria:
        story.append(_p(
            f"Note: {len(extra_criteria)} additional criteria (C{MAX_COLS+1}–C{len(approved_criteria)}) "
            "are detailed in the Evidence Summary below.", note_s))
        story.append(Spacer(1, 0.2 * cm))

    # Matrix grid
    bidder_cw   = min(5.0 * cm, PAGE_W * 0.32)
    verdict_cw  = 1.8 * cm
    crit_unit   = (PAGE_W - bidder_cw - verdict_cw) / max(len(disp_criteria), 1)
    crit_cw     = min(1.6 * cm, crit_unit)
    mat_cw      = [bidder_cw, verdict_cw] + [crit_cw] * len(disp_criteria)

    mat_hdr = ([_p("Bidder", label_s), _p("Overall", label_s)]
               + [_p(f"C{i+1}", label_s) for i in range(len(disp_criteria))])
    mat_rows = [mat_hdr]
    mat_style = [
        ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 7),
        ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
        ("ALIGN",         (0, 0), (0, -1), "LEFT"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
    ]

    for ri, bidder in enumerate(tender.bidders, start=1):
        ov = bidder.overall_verdict
        row = [
            _p(bidder.company_name[:38], cell_s),
            _p(VERDICT_SHORT.get(ov.value, "?"), cell_s),
        ]
        for c in disp_criteria:
            v = next((x for x in bidder.verdicts if x.criterion_id == c.criterion_id), None)
            row.append(_p(VERDICT_SHORT.get((v.override_verdict or v.verdict).value, "?"), cell_s) if v else _p("—", cell_s))
        mat_rows.append(row)
        mat_style.append(("BACKGROUND", (1, ri), (1, ri), OVERALL_BG.get(ov, colors.white)))

    mat_t = Table(mat_rows, colWidths=mat_cw)
    mat_t.setStyle(TableStyle(mat_style))
    story.append(mat_t)

    # ── Criterion-Level Evidence Summary ───────────────────────────────────────
    story.append(PageBreak())
    story.append(_p("Criterion-Level Evidence Summary", h2_s))

    all_c_by_id = {c.criterion_id: c for c in approved_criteria}

    for bidder in tender.bidders:
        ov = bidder.overall_verdict
        header_block = [_p(f"{bidder.company_name}  —  Overall: {ov.value}", h3_s)]
        if bidder.gstin or bidder.pan:
            meta_parts = filter(None, [
                f"GSTIN: {bidder.gstin}" if bidder.gstin else None,
                f"PAN: {bidder.pan}" if bidder.pan else None,
                f"KYC: {bidder.kyc_status}" if getattr(bidder, "kyc_status", None) else None,
            ])
            header_block.append(_p("  |  ".join(meta_parts), label_s))

        ev_hdr = [[_p("Criterion", label_s), _p("Cat.", label_s),
                   _p("Verdict", label_s), _p("Reason", label_s),
                   _p("Source Doc", label_s), _p("Pg.", label_s), _p("Conf.", label_s)]]
        ev_rows = []
        v_by_crit = {v.criterion_id: v for v in bidder.verdicts}

        for c in approved_criteria:
            v = v_by_crit.get(c.criterion_id)
            cat_str = c.category.value if hasattr(c.category, "value") else str(c.category)
            if v:
                eff = (v.override_verdict or v.verdict).value
                reason = v.reason[:200] + ("…" if len(v.reason) > 200 else "")
                conf   = f"{v.confidence:.0%}" if v.confidence is not None else "—"
                v_label = eff.replace("_", " ")
                ev = v.evidence
                if ev:
                    doc_name = "—"
                    if ev.source_doc_id and ev.source_document:
                        raw = ev.source_document.original_filename or ev.source_document.filename
                        doc_name = raw[:28] + "…" if len(raw) > 28 else raw
                    ev_page = str(ev.source_page) if ev.source_page else "—"
                else:
                    doc_name = "—"
                    ev_page  = "—"
            else:
                eff      = "PENDING"
                reason   = "Evaluation not yet triggered."
                conf     = "—"
                v_label  = "NOT RUN"
                doc_name = "—"
                ev_page  = "—"

            desc = c.description[:60] + ("…" if len(c.description) > 60 else "")
            ev_rows.append([
                _p(desc, cell_s), _p(cat_str[:10], label_s),
                _p(v_label, cell_s), _p(reason, cell_s),
                _p(doc_name, label_s), _p(ev_page, label_s), _p(conf, label_s),
            ])

        ev_cw = [PAGE_W * 0.19, PAGE_W * 0.09, PAGE_W * 0.10, PAGE_W * 0.37,
                 PAGE_W * 0.15, PAGE_W * 0.04, PAGE_W * 0.06]
        ev_style_cmds = [
            ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 7),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ]
        for ri2, (c, row) in enumerate(zip(approved_criteria, ev_rows), start=1):
            vv = v_by_crit.get(c.criterion_id)
            if vv:
                eff2 = (vv.override_verdict or vv.verdict).value
                bg = (colors.HexColor("#f0fdf4") if eff2 == "ELIGIBLE"
                      else colors.HexColor("#fef2f2") if eff2 == "NOT_ELIGIBLE"
                      else colors.HexColor("#fffbeb"))
                ev_style_cmds.append(("BACKGROUND", (2, ri2), (2, ri2), bg))

        all_ev_rows = ev_hdr + ev_rows
        ev_t = Table(all_ev_rows, colWidths=ev_cw)
        ev_t.setStyle(TableStyle(ev_style_cmds))

        story.append(KeepTogether(header_block))
        story.append(ev_t)
        story.append(Spacer(1, 0.35 * cm))

    # ── Audit Declaration ──────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(_p("Audit Declaration", h2_s))
    story.append(HRFlowable(width="100%", thickness=0.5,
                             color=colors.HexColor("#e2e8f0"), spaceAfter=6))
    story.append(_p(
        "This report is generated by <b>TenderGraph AI+</b> and represents the output of a deterministic, "
        "rule-based eligibility evaluation pipeline. Evidence was extracted from bidder-submitted documents "
        "using GPT-4o OCR; all eligibility verdicts were produced by a Python rule engine and are fully "
        "traceable to source pages and clauses. Extractions with confidence below the configured threshold "
        "are escalated to the Manual Review Queue and excluded from automatic disqualification. "
        "This report does not constitute a final procurement decision. It must be reviewed and countersigned "
        "by an authorised Procurement Officer before any tender award communication.",
        body_s,
    ))
    story.append(Spacer(1, 0.8 * cm))
    story.append(_p(
        f"Generated: {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}  |  Powered by TenderGraph AI+",
        label_s,
    ))

    doc.build(story)
    return buffer.getvalue()


@router.post("/generate")
def generate_report(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a PDF report and stream it directly. No file stored on disk."""
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    pdf_bytes   = _generate_pdf(tender)
    report_hash = hashlib.sha256(pdf_bytes).hexdigest()

    summary = {
        "total_bidders": len(tender.bidders),
        "eligible":      sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.ELIGIBLE),
        "not_eligible":  sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NOT_ELIGIBLE),
        "needs_review":  sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.NEEDS_MANUAL_REVIEW),
        "pending":       sum(1 for b in tender.bidders if b.overall_verdict == OverallVerdict.PENDING),
    }

    report = EvaluationReport(
        report_id=str(uuid.uuid4()),
        tender_id=tender_id,
        generated_by=current_user.user_id,
        report_path=None,
        report_hash=report_hash,
        report_type="PDF",
        summary_json=summary,
    )
    db.add(report)
    db.commit()

    audit_service.log_event(
        db=db, event_type=AuditEventType.REPORT_EXPORTED,
        actor_id=current_user.user_id, actor_type="HUMAN",
        payload={"report_id": report.report_id, "report_hash": report_hash, **summary},
        tender_id=tender_id,
    )

    filename = f"TenderGraph_Report_{tender.nit_number or tender_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Id":         report.report_id,
            "X-Report-Hash":       report_hash,
        },
    )


@router.get("/{report_id}/download")
def download_report(
    tender_id: str,
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-generate a previously logged report on demand and stream it."""
    report = db.query(EvaluationReport).filter(
        EvaluationReport.report_id == report_id,
        EvaluationReport.tender_id == tender_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report record not found.")

    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    pdf_bytes = _generate_pdf(tender)
    filename  = f"TenderGraph_Report_{tender.nit_number or tender_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/", response_model=List[ReportOut])
def list_reports(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.tender_id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    return tender.reports
