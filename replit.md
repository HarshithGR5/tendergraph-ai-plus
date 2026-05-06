# TenderGraph AI+

AI-Powered Tender Evaluation & Bidder Eligibility Platform for government procurement — extracts eligibility criteria from tender documents, evaluates bidder submissions using GPT-4o OCR + a deterministic rule engine, and produces criterion-level explainable verdicts with an immutable audit trail.

## Run & Operate

- **Start backend**: `uvicorn backend.main:app --host localhost --port 8000 --reload`
- **Run migrations**: `python -m alembic -c backend/alembic.ini upgrade head`
- **Create new migration**: `python -m alembic -c backend/alembic.ini revision --autogenerate -m "description"`
- **API docs**: `http://localhost:8000/api/docs`
- **Health check**: `GET /api/health`

Required env vars:
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `OPENAI_API_KEY` — GPT-4o for OCR and LLM extraction tasks

## Stack

- **Runtime**: Python 3.11
- **API**: FastAPI 0.115 + Uvicorn
- **ORM**: SQLAlchemy 2.0 + Alembic migrations
- **DB**: PostgreSQL (Replit managed)
- **Task queue**: Celery + Redis (workers optional — background tasks run in FastAPI BackgroundTasks for now)
- **LLM/OCR**: GPT-4o (OpenAI) via structured JSON output mode
- **PDF parsing**: PyMuPDF + pdfplumber (native), GPT-4o Vision (scanned)
- **Auth**: JWT (python-jose + passlib bcrypt)
- **Reports**: ReportLab PDF generation

## Where things live

```
backend/
├── main.py               # FastAPI app + router registration
├── config.py             # Pydantic settings (env-based)
├── database.py           # SQLAlchemy engine + session
├── models/tables.py      # All ORM models (10 tables)
├── api/                  # Routers: auth, tenders, bidders, verdicts, reviews, reports, audit
├── services/             # tender_parser, ocr_engine, extraction_service, rule_engine, audit_service
├── workers/              # Celery tasks: ocr_worker, extract_worker, rule_worker
├── rules/                # Deterministic rule functions: financial, technical, compliance
├── prompts/              # Jinja2 prompt templates: criterion_extract.j2, evidence_extract.j2
├── alembic/              # Alembic env + migration versions
└── storage/              # Local file storage (tenders/, bidders/, reports/)
```

## Architecture decisions

- **AI extraction ≠ final verdict**: GPT-4o extracts structured evidence; a deterministic Python rule engine makes all eligibility decisions. This separation ensures reproducibility and legal defensibility.
- **Confidence gating**: Any extraction with confidence < 0.60 is escalated to `NEEDS_MANUAL_REVIEW` — no bidder is silently disqualified.
- **Immutable audit trail**: `audit_events` table is append-only with SHA-256 hash chaining across every row. Tamper-evident.
- **Local storage first**: All uploaded documents stored to `./backend/storage/` filesystem. No cloud object storage dependency.
- **Background tasks**: FastAPI `BackgroundTasks` used instead of Celery workers by default (no Redis required in dev). Celery workers available when Redis is running.

## Product

Five evaluation workflow views:
1. **Tender Overview** — upload tender, review/approve extracted criteria
2. **Bidder Comparison Matrix** — colour-coded verdict matrix across all bidders × criteria
3. **Individual Bidder Report** — per-bidder criterion-by-criterion evaluation with evidence chain
4. **Manual Review Queue** — task board for NEEDS_MANUAL_REVIEW cases with override logging
5. **Audit Trail Viewer** — chronological immutable event log with hash-chain verification

## Gotchas

- The `DATABASE_URL` from Replit requires `sslmode=require` — handled in `database.py` connect_args.
- OCR for scanned PDFs uses GPT-4o Vision — costs API credits per page.
- Alembic ini file is at `backend/alembic.ini`, not the project root.
- Criterion verdicts have a unique constraint on `(bidder_id, criterion_id)` — re-running evaluation updates existing records.

## Pointers

- DB schema: `backend/models/tables.py`
- API contracts: `http://localhost:8000/api/docs` (auto-generated OpenAPI)
- LLM prompts: `backend/prompts/criterion_extract.j2`, `backend/prompts/evidence_extract.j2`
- Confidence thresholds: `backend/config.py`
