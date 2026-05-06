import logging
from datetime import datetime

from backend.database import SessionLocal
from backend.models.tables import (
    AuditEventType, BidderDocument, DocumentChunk, OCRStatus
)
from backend.services import audit_service
from backend.services.ocr_engine import extract_document
from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_CHUNK_CHARS = 3000
OVERLAP_CHARS = 400


def _chunk_text(text: str, page_num: int, doc_id: str) -> list[dict]:
    chunks = []
    start = 0
    idx = 0
    while start < len(text):
        end = min(start + MAX_CHUNK_CHARS, len(text))
        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append({
                "chunk_text": chunk_text,
                "page_number": page_num,
                "chunk_index": idx,
                "token_count": len(chunk_text.split()),
                "extraction_confidence": 1.0,
            })
            idx += 1
        start = end - OVERLAP_CHARS if end < len(text) else end
    return chunks


@celery_app.task(name="backend.workers.ocr_worker.process_bidder_document", bind=True, max_retries=2)
def process_bidder_document(self, doc_id: str):
    db = SessionLocal()
    try:
        doc = db.query(BidderDocument).filter(BidderDocument.doc_id == doc_id).first()
        if not doc:
            logger.error(f"Document {doc_id} not found")
            return {"status": "error", "message": "Document not found"}

        doc.ocr_status = OCRStatus.PROCESSING
        db.commit()

        result = extract_document(doc.storage_path)

        all_chunks = []
        for page_data in result["pages"]:
            page_chunks = _chunk_text(page_data["text"], page_data["page"], doc_id)
            for ch in page_chunks:
                ch["extraction_confidence"] = page_data.get("confidence", 0.9)
            all_chunks.extend(page_chunks)

        for chunk_data in all_chunks:
            chunk = DocumentChunk(
                doc_id=doc_id,
                chunk_text=chunk_data["chunk_text"],
                page_number=chunk_data["page_number"],
                chunk_index=chunk_data["chunk_index"],
                token_count=chunk_data["token_count"],
                extraction_confidence=chunk_data["extraction_confidence"],
            )
            db.add(chunk)

        doc.ocr_status = OCRStatus.COMPLETE
        doc.ocr_confidence = result["avg_confidence"]
        doc.page_count = result["page_count"]
        doc.extracted_text_preview = result["full_text"][:500] if result["full_text"] else ""
        doc.processed_at = datetime.utcnow()
        db.commit()

        audit_service.log_event(
            db=db,
            event_type=AuditEventType.OCR_COMPLETED,
            actor_id="SYSTEM",
            payload={
                "doc_id": doc_id,
                "page_count": result["page_count"],
                "chunk_count": len(all_chunks),
                "avg_confidence": result["avg_confidence"],
            },
            bidder_id=doc.bidder_id,
        )

        return {"status": "success", "doc_id": doc_id, "chunks": len(all_chunks)}

    except Exception as e:
        logger.exception(f"OCR worker failed for doc {doc_id}: {e}")
        try:
            doc = db.query(BidderDocument).filter(BidderDocument.doc_id == doc_id).first()
            if doc:
                doc.ocr_status = OCRStatus.FAILED
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()


@celery_app.task(name="backend.workers.ocr_worker.process_tender_document", bind=True, max_retries=2)
def process_tender_document(self, tender_id: str):
    from backend.services.tender_parser import process_tender
    db = SessionLocal()
    try:
        result = process_tender(tender_id, db)
        return {"status": "success" if result else "error", "tender_id": tender_id}
    except Exception as e:
        logger.exception(f"Tender OCR worker failed for {tender_id}: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()
