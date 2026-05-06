# TenderGraph AI+

> **AI-Powered Tender Evaluation & Bidder Eligibility Platform for Government Procurement**  
> Theme 3 · CRPF Hackathon Submission

TenderGraph AI+ transforms the manual, error-prone process of government tender evaluation into a structured, explainable, and cryptographically auditable AI-assisted workflow. It ingests tender documents of any format, extracts structured eligibility criteria, evaluates bidder submissions with OCR + GPT-4o, and produces **criterion-level eligibility verdicts** that every procurement officer can trust, verify, and sign off on.

---

## The Problem

A procurement officer at CRPF or any central government body receives a tender document spanning 80–200 pages with eligibility conditions scattered across multiple sections. For a competitive tender with 10 bidders and 12 eligibility criteria, that is **120 individual checks** — each requiring a human to locate a document, find the relevant value, and compare it against the tender clause. The resulting problems:

- **Inconsistency** — Two evaluators may reach different conclusions from the same documents
- **Oversight** — Officers miss criteria buried in sub-clauses
- **Non-auditability** — Manual checklists are often reconstructed after the fact
- **Legal exposure** — Any of the above can result in successful legal challenges to the award

---

## Three Non-Negotiable Principles

| Principle | Mechanism |
|-----------|-----------|
| **No silent disqualification** | Any extraction with confidence < 0.60 is escalated to `NEEDS_MANUAL_REVIEW` |
| **Criterion-level explainability** | Every verdict cites tender clause · document · page · extracted value |
| **Immutable auditability** | SHA-256 hash-chained `audit_events` table — verifiable by CVC / High Courts |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Tender Upload → OCR Pipeline → Criterion Extraction (LLM)  │
│                                      ↓                       │
│  Bidder Upload → OCR Pipeline → Evidence Extraction (LLM)   │
│                                      ↓                       │
│              Deterministic Rule Engine (Python)              │
│         AI EXTRACTS · RULES DECIDE · NEVER LLM VERDICT      │
│                                      ↓                       │
│  Confidence Gate → ELIGIBLE / NOT_ELIGIBLE / NEEDS_REVIEW   │
│                                      ↓                       │
│  Human Review → Override Logged → PDF Report → Audit Trail  │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural decision:** The AI extraction layer and rule-based decision layer are strictly separated. AI is never given the authority to emit a final eligibility verdict. It extracts structured data from unstructured documents. The rule engine applies deterministic logic to that structured data. This separation is what makes the platform legally defensible.

---

## Stack

| Layer | Technology |
|-------|-----------|
| **API** | FastAPI 0.115 + Uvicorn |
| **Database** | PostgreSQL (SQLAlchemy 2.0 + Alembic migrations) |
| **AI / LLM** | GPT-4o (OpenAI) — structured JSON output mode |
| **PDF / OCR** | PyMuPDF · pdfplumber · pytesseract · GPT-4o Vision |
| **Auth** | JWT (python-jose) + bcrypt password hashing |
| **Task Queue** | FastAPI BackgroundTasks (Celery + Redis optional) |
| **Reports** | ReportLab PDF generation |
| **Frontend** | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| **State** | Zustand + React Query |
| **Charts** | Recharts |

---

## Project Structure

```
tendergraph-ai-plus/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Pydantic settings (env-based)
│   ├── database.py              # SQLAlchemy engine + session
│   ├── alembic.ini              # Alembic migration config
│   ├── api/
│   │   ├── auth.py              # Registration, login, JWT
│   │   ├── tenders.py           # Tender upload + criteria management
│   │   ├── bidders.py           # Bidder registration + document upload
│   │   ├── verdicts.py          # Criterion verdict queries
│   │   ├── reviews.py           # Manual review task workflow
│   │   ├── reports.py           # PDF report generation + download
│   │   └── audit.py             # Audit trail + hash chain verification
│   ├── models/
│   │   └── tables.py            # All 10 SQLAlchemy ORM models
│   ├── services/
│   │   ├── tender_parser.py     # Tender OCR + criteria extraction pipeline
│   │   ├── ocr_engine.py        # Multi-format OCR (PDF/DOCX/image/scanned)
│   │   ├── extraction_service.py# Evidence extraction per criterion
│   │   ├── rule_engine.py       # Deterministic eligibility rule engine
│   │   └── audit_service.py     # Hash-chained audit event writer
│   ├── rules/
│   │   ├── financial.py         # Turnover, EMD, net-worth rules
│   │   ├── technical.py         # Similar-works, personnel, machinery rules
│   │   └── compliance.py        # GST/PAN, certifications, blacklist rules
│   ├── workers/
│   │   ├── celery_app.py        # Celery app (Redis broker)
│   │   ├── ocr_worker.py        # Async OCR task
│   │   ├── extract_worker.py    # Async evidence extraction task
│   │   └── rule_worker.py       # Async rule engine task
│   ├── prompts/
│   │   ├── criterion_extract.j2 # LLM prompt: tender criteria extraction
│   │   └── evidence_extract.j2  # LLM prompt: bidder evidence extraction
│   ├── alembic/                 # Migration versions
│   └── storage/                 # Uploaded files (tenders/ bidders/ reports/)
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Public landing page
│   │   ├── login/page.tsx       # Sign in
│   │   ├── register/page.tsx    # Account creation with role selection
│   │   └── (dashboard)/
│   │       ├── dashboard/       # Overview + metrics
│   │       ├── tenders/         # Tender list + upload
│   │       ├── tenders/[id]/    # Tender detail + criteria approval
│   │       │   ├── matrix/      # Bidder comparison matrix
│   │       │   ├── reviews/     # Manual review queue
│   │       │   ├── audit/       # Audit trail viewer
│   │       │   └── reports/     # Evaluation reports
│   │       └── settings/        # System settings
│   ├── components/
│   │   ├── layout/              # Sidebar (role-aware) + Header
│   │   ├── dashboard/           # Metric cards + charts
│   │   ├── tenders/             # Tender cards + upload modal + criterion cards
│   │   ├── matrix/              # Bidder matrix + evidence drawer
│   │   ├── reviews/             # Review task cards
│   │   ├── audit/               # Audit timeline
│   │   └── ui/                  # Badge · skeleton · empty-state · confidence-meter
│   └── lib/
│       ├── api/                 # Typed API wrappers for every endpoint
│       ├── stores/              # Zustand auth store
│       ├── types/               # TypeScript interfaces matching backend models
│       └── utils.ts             # Currency · date · confidence formatters
├── requirements.txt
├── start.sh
└── README.md
```

---

## User Roles

| Role | Access Level | Key Capabilities |
|------|-------------|-----------------|
| **PROCUREMENT_OFFICER** | Standard | Upload tenders, register bidders, run AI evaluation, download reports, complete review tasks |
| **SENIOR_OFFICER** | Elevated | All Officer permissions + approve criteria schemas, override verdicts with logged reason, sign reports |
| **SYSTEM_ADMIN** | Full | All Senior Officer permissions + create/manage users, configure confidence thresholds, export full audit data |
| **AUDIT_REVIEWER** | Read-only | View all tenders and verdicts, verify SHA-256 hash chain integrity, export audit trail JSON for CVC |

---

## Five Dashboard Views

| View | Purpose |
|------|---------|
| **Tender Overview** | Upload tender · AI extracts criteria · Officer approves schema |
| **Bidder Comparison Matrix** | Colour-coded verdict grid: all bidders × all criteria |
| **Individual Bidder Report** | Per-bidder criterion-by-criterion evaluation with evidence chain |
| **Manual Review Queue** | Task board for all `NEEDS_MANUAL_REVIEW` cases with override logging |
| **Audit Trail Viewer** | Chronological immutable log with hash-chain verification on demand |

---

## Quick Start

### Prerequisites

- Python 3.11
- Node.js 20
- PostgreSQL database (connection string in `DATABASE_URL`)
- OpenAI API key

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/tendergraph-ai-plus.git
cd tendergraph-ai-plus
```

Set environment variables:
```bash
export DATABASE_URL="postgresql://user:pass@host/db"
export OPENAI_API_KEY="sk-..."
export SECRET_KEY="your-secure-secret-key"
```

### 2. Backend Setup

```bash
pip install -r requirements.txt
python -m alembic -c backend/alembic.ini upgrade head
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Create Your First User

With the backend running, register via the UI at `http://localhost:3000/register` or via the API:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "SecurePass@123",
    "full_name": "System Administrator",
    "role": "SYSTEM_ADMIN"
  }'
```

---

## API Reference

Interactive API documentation is available at `http://localhost:8000/api/docs` (Swagger UI) and `http://localhost:8000/api/redoc` (ReDoc).

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create user account |
| `POST` | `/api/auth/login` | Authenticate, receive JWT |
| `GET`  | `/api/auth/me` | Get current user profile |
| `POST` | `/api/tenders/` | Upload tender document |
| `GET`  | `/api/tenders/` | List all tenders |
| `GET`  | `/api/tenders/{id}` | Tender detail + criteria |
| `POST` | `/api/tenders/{id}/approve-criteria` | Approve extracted criteria schema |
| `POST` | `/api/bidders/` | Register bidder |
| `POST` | `/api/bidders/{id}/documents` | Upload bidder document |
| `POST` | `/api/bidders/{id}/evaluate` | Trigger rule engine evaluation |
| `GET`  | `/api/verdicts/matrix/{tender_id}` | Bidder comparison matrix |
| `GET`  | `/api/reviews/` | List manual review tasks |
| `POST` | `/api/reviews/{id}/resolve` | Resolve review task with override |
| `POST` | `/api/reports/{tender_id}` | Generate PDF evaluation report |
| `GET`  | `/api/audit/events` | Query audit trail |
| `GET`  | `/api/audit/verify-chain` | Verify SHA-256 hash chain |

---

## Database Schema (Key Tables)

```
users              — User accounts with roles
tenders            — Tender documents + processing status
tender_criteria    — Extracted eligibility criteria (AI-generated)
bidders            — Registered bidders per tender
bidder_documents   — Uploaded submission documents
document_chunks    — OCR text chunks for retrieval
bidder_evidence    — Extracted evidence per criterion per bidder
criterion_verdicts — Eligibility verdicts (rule engine output)
review_tasks       — Manual review queue items
audit_events       — Immutable hash-chained event log
evaluation_reports — Generated PDF reports metadata
```

---

## Confidence Thresholds

| Threshold | Value | Effect |
|-----------|-------|--------|
| OCR confidence | 0.60 | Below → `NEEDS_MANUAL_REVIEW` |
| Extraction confidence | 0.75 | Below → `NEEDS_MANUAL_REVIEW` |
| Manual review gate | 0.80 | High-confidence auto-verdict only above this |
| Similar works (eligible) | 0.72 | Cosine similarity threshold |
| Similar works (review) | 0.55 | Below 0.55 → `NOT_ELIGIBLE` |

---

## Audit Trail

Every state-changing event is written to `audit_events` using an append-only path. Each record includes:

- `event_id` — UUID v4
- `event_type` — `CRITERION_EXTRACTED`, `VERDICT_EMITTED`, `HUMAN_OVERRIDE_APPLIED`, `REPORT_EXPORTED`, etc.
- `actor_id` — System service ID or human officer ID
- `payload_json` — Full JSON payload of the event
- `prev_hash` — SHA-256 of the previous audit record
- `hash` — `SHA-256(event_id + event_type + actor_id + payload + prev_hash)`
- `timestamp` — PostgreSQL server timestamp (not client-provided)

The hash chain means any deletion or modification of any record breaks the chain — verifiable by any third party via `GET /api/audit/verify-chain`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | GPT-4o for OCR and criteria/evidence extraction |
| `SECRET_KEY` | Yes | JWT signing key |
| `REDIS_URL` | No | Redis broker for Celery workers (optional) |
| `STORAGE_BASE_PATH` | No | File storage path (default: `./backend/storage`) |
| `DEBUG` | No | Enable debug logging (default: `false`) |

---

## License

This project is submitted as part of the CRPF Hackathon (Theme 3 — AI-Based Tender Evaluation). All rights reserved.
