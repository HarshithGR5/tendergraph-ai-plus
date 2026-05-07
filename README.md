# TenderGraph AI+

**Enterprise Procurement Intelligence Platform**

AI-powered tender evaluation and bidder eligibility platform for government procurement. Extracts eligibility criteria from tender documents, evaluates bidder submissions using GPT-4o OCR + a deterministic rule engine, and produces criterion-level explainable verdicts with an immutable audit trail.

---

## Architecture Principle

```
AI Extracts → Rule Engine Decides → Human Reviews → Audit Records
```

GPT-4o reads unstructured documents and extracts structured evidence. A deterministic Python rule engine makes **all** final eligibility decisions — never the AI directly. This separation ensures reproducibility and legal defensibility.

---

## Quick Start

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Install Node dependencies
cd frontend && npm install && cd ..

# 3. Set required environment variables
export DATABASE_URL="postgresql://..."
export OPENAI_API_KEY="sk-..."
export SECRET_KEY="your-secret-key"

# 4. Run database migrations
python -m alembic -c backend/alembic.ini upgrade head

# 5. Start backend API
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 6. Start frontend (separate terminal)
cd frontend && npm run dev -- --port 5000
```

- **API docs**: `http://localhost:8000/api/docs`
- **Health check**: `GET /api/health`

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Python 3.11 + Node.js 20 |
| API | FastAPI 0.115 + Uvicorn |
| ORM | SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL |
| Auth | JWT (python-jose) + bcrypt 4.0.1 (pinned) |
| LLM/OCR | GPT-4o (OpenAI) via structured JSON output |
| PDF parsing | PyMuPDF + pdfplumber (native), GPT-4o Vision (scanned) |
| Reports | ReportLab PDF generation |
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 |
| State | Zustand + React Query |
| Charts | Recharts |

---

## User Roles & Permissions

| Role | Key Capabilities |
|------|----------------|
| `BIDDER` | Self-register to open tenders, upload own company documents, track submission status and verdict |
| `PROCUREMENT_OFFICER` | View tenders and bidder lists, trigger AI evaluation, manage review tasks |
| `SENIOR_OFFICER` | Upload tenders, approve extracted criteria, override AI verdicts (all logged), sign reports |
| `SYSTEM_ADMIN` | All Senior Officer permissions + user management, system config, full audit access |
| `AUDIT_REVIEWER` | Read-only access to audit trail and SHA-256 hash-chain verification |

### Security Model

- **Tender upload**: `SENIOR_OFFICER` and `SYSTEM_ADMIN` only
- **Criteria approve/reject**: `SENIOR_OFFICER` and `SYSTEM_ADMIN` only
- **Verdict overrides**: `SENIOR_OFFICER` and `SYSTEM_ADMIN` only
- **Bidder document upload**: `BIDDER` role only, own profile only — officers have zero write access
- **View password gate**: Tenders can be set with a password; officers must enter it to view bidder applications; every access is logged to the immutable audit trail

---

## Product Views (Authenticated)

1. **Tender Overview** — upload tender, review/approve extracted criteria
2. **Bidder Comparison Matrix** — colour-coded verdict matrix across all bidders × criteria
3. **Individual Bidder Report** — per-bidder criterion-by-criterion evaluation with evidence chain
4. **Manual Review Queue** — task board for `NEEDS_MANUAL_REVIEW` cases with override logging
5. **Audit Trail Viewer** — chronological immutable event log with SHA-256 hash-chain verification

---

## Bidder Self-Registration Flow

1. Bidder creates an account with role `BIDDER`
2. Browses the public list of open tenders from the dashboard
3. Self-registers to a tender by providing company details (name, GSTIN, PAN, etc.)
4. Uploads their own submission documents directly to their bidder profile
5. Officers trigger AI evaluation; bidder can track overall verdict status
6. Every upload and access event is logged to the tamper-evident audit trail

---

## Key Design Decisions

- **AI extraction ≠ final verdict**: GPT-4o extracts structured evidence; a deterministic Python rule engine makes all eligibility decisions. Reproducible and legally defensible.
- **Confidence gating**: Extractions with confidence < 0.60 are escalated to `NEEDS_MANUAL_REVIEW` — no bidder is silently disqualified.
- **Immutable audit trail**: `audit_events` table is append-only with SHA-256 hash chaining. Tamper-evident, verifiable by any external auditor.
- **Document ownership**: Bidder documents can only be uploaded by the bidder's own account. Officers have zero write access to bidder document storage — enforced at the API layer.
- **Local storage first**: All uploaded documents stored to `./backend/storage/`. No cloud object storage dependency.
- **bcrypt pinned at 4.0.1**: passlib[bcrypt] with bcrypt==4.0.1 is required. Do not upgrade.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | GPT-4o for OCR and LLM extraction |
| `SECRET_KEY` | Recommended | JWT signing key (defaults to insecure value) |

---

## Project Structure

```
backend/
├── main.py               # FastAPI app + router registration
├── config.py             # Pydantic settings (env-based)
├── database.py           # SQLAlchemy engine + session
├── models/tables.py      # All ORM models — UserRole includes BIDDER
├── api/
│   ├── auth.py           # Register, login, JWT, require_role() guard
│   ├── tenders.py        # Upload (Senior+ only), criteria approve (Senior+ only), view password
│   ├── bidders.py        # Bidder self-register, document upload (BIDDER only, own profile)
│   ├── verdicts.py       # Evaluation matrix, verdict override (Senior+ only)
│   ├── reviews.py        # Review queue; resolve locked to Senior+ only
│   ├── global_reviews.py # Cross-tender review queue (internal staff only)
│   ├── reports.py        # PDF report generation
│   └── audit.py          # Audit trail + hash-chain verification
├── services/             # tender_parser, ocr_engine, extraction_service, rule_engine, audit_service
├── rules/                # Deterministic rule functions: financial, technical, compliance
├── prompts/              # Jinja2 prompt templates
├── alembic/              # Alembic env + migration versions
└── storage/              # Local file storage (tenders/, bidders/, reports/)

frontend/
├── app/
│   ├── page.tsx          # Public landing page (5 roles, workflow, features)
│   ├── login/            # Sign-in page with 5-role legend panel
│   ├── register/         # Account creation — 5 roles including BIDDER
│   ├── presentation/     # Platform overview slide deck (20 slides, no hackathon references)
│   └── (dashboard)/      # All authenticated views (role-gated)
├── components/
│   ├── layout/           # Sidebar (role-aware — BIDDER gets own Bidder Portal nav)
│   └── ...
└── lib/
    ├── types/index.ts    # UserRole includes "BIDDER"
    └── ...
```

---

## Gotchas

- **bcrypt must be 4.0.1** — passlib is incompatible with bcrypt 5.x; login collapses silently.
- `DATABASE_URL` from Replit already contains `?ssl` — no extra connect_args needed.
- OCR for scanned PDFs uses GPT-4o Vision — costs API credits per page.
- Alembic ini file is at `backend/alembic.ini`, not the project root.
- Criterion verdicts have a unique constraint on `(bidder_id, criterion_id)` — re-running evaluation updates existing records.
- Bidder document upload is locked to the BIDDER account that owns the profile; the `uploaded_by` column on `bidder_documents` records which user uploaded each file.
