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
- **Postman collection**: `TenderGraph_API.postman_collection.json` (import into Postman)
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
| Reports | ReportLab PDF generation (streamed — no disk storage) |
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 |
| State | Zustand + React Query |
| Charts | Recharts |

---

## User Roles & Permissions

| Role | Key Capabilities |
|------|----------------|
| `BIDDER` | Self-register to open tenders, upload documents (bulk or single), confirm & lock submission, track KYC and verdict |
| `PROCUREMENT_OFFICER` | View tenders and bidder lists, trigger AI evaluation (single or bulk), manage review tasks |
| `SENIOR_OFFICER` | Upload tenders, approve extracted criteria, add reviewer notes to criteria, override AI verdicts (all logged), sign reports |
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

1. **Dashboard** — live verdict distribution chart, per-status bidder counts, open review task count, tender pipeline chart, recent activity feed
2. **Tender Overview** — upload tender, review/approve extracted criteria with inline reviewer notes, bulk bidder upload
3. **Bidder Comparison Matrix** — colour-coded verdict matrix across all bidders × criteria, evidence drawer with evidence citations + KYC verification status
4. **Individual Bidder Report** — per-bidder criterion-by-criterion evaluation with evidence chain and source document + page references in PDF exports
5. **Manual Review Queue** — task board for `NEEDS_MANUAL_REVIEW` cases with evidence citation panel and override logging
6. **Audit Trail Viewer** — chronological immutable event log with human-readable per-event-type detail and SHA-256 hash-chain verification

---

## Bidder Submission Flow

1. Bidder creates an account with role `BIDDER`
2. Browses the public list of open tenders from the dashboard
3. Self-registers to a tender by providing company details (name, GSTIN, PAN, etc.)
4. Uploads submission documents — single or **bulk multi-file upload** — can delete and re-upload freely while in **Draft** state
5. Clicks **Confirm & Lock** → confirmation modal appears; after confirmation, submission is locked and no further uploads/deletions are allowed
6. KYC verification (GSTIN, PAN, debarment check) runs automatically in the background
7. A procurement officer triggers AI evaluation (single bidder or **Evaluate All**)
8. Bidder can track overall verdict and KYC status on the tender page

---

## Key API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create account (role in body) |
| `POST` | `/api/auth/login` | Login — returns JWT |
| `GET`  | `/api/auth/me` | Current user info |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/dashboard/stats` | Aggregated verdict counts, bidder totals, open review tasks |

### Tenders
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/tenders/` | List all tenders |
| `POST` | `/api/tenders/` | Upload tender PDF/DOCX (Senior+) |
| `GET`  | `/api/tenders/{id}` | Get tender detail |
| `DELETE` | `/api/tenders/{id}` | Delete tender (Admin only) |
| `GET`  | `/api/tenders/{id}/criteria` | List extracted criteria |
| `POST` | `/api/tenders/{id}/criteria` | Add criterion manually |
| `PATCH`| `/api/tenders/{id}/criteria/{cid}` | Update criterion (incl. reviewer_notes) |
| `POST` | `/api/tenders/{id}/criteria/approve-all` | Approve all criteria |
| `POST` | `/api/tenders/{id}/criteria/{cid}/approve` | Approve single criterion |
| `DELETE` | `/api/tenders/{id}/criteria/{cid}` | Delete criterion |

### Bidders
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/tenders/{id}/bidders/` | List bidders for tender |
| `POST` | `/api/tenders/{id}/bidders/self-register` | Bidder self-registers |
| `GET`  | `/api/tenders/{id}/bidders/my-registration` | My registration for this tender |
| `POST` | `/api/tenders/{id}/bidders/{bid}/documents` | Upload single document |
| `POST` | `/api/tenders/{id}/bidders/{bid}/documents/bulk` | Upload multiple documents at once |
| `DELETE`| `/api/tenders/{id}/bidders/{bid}/documents/{did}` | Delete document (draft only) |
| `POST` | `/api/tenders/{id}/bidders/{bid}/confirm-submission` | Lock submission + trigger KYC |
| `POST` | `/api/tenders/{id}/bidders/{bid}/evaluate` | Trigger single evaluation |
| `POST` | `/api/tenders/{id}/bidders/evaluate-all` | Evaluate all bidders (bulk) |

### Verdicts & Reviews
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/tenders/{id}/matrix` | Bidder × criterion matrix |
| `POST` | `/api/tenders/{id}/bidders/{bid}/verdicts/{vid}/override` | Override verdict (Senior+) |
| `GET`  | `/api/tenders/{id}/reviews/` | Review tasks for tender |
| `POST` | `/api/tenders/{id}/reviews/{tid}/resolve` | Resolve review task |

### Reports (Streaming PDF)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tenders/{id}/reports/generate` | Generate + stream PDF (no disk write) |
| `GET`  | `/api/tenders/{id}/reports/` | List generated reports |
| `GET`  | `/api/tenders/{id}/reports/{rid}/download` | Re-stream existing report |

### KYC
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/kyc/verify-gstin` | Validate GSTIN format + sandbox check |
| `POST` | `/api/kyc/verify-pan` | Validate PAN format |
| `POST` | `/api/kyc/check-debarment` | Check debarment registry |
| `POST` | `/api/kyc/full-check` | Run all KYC checks in one call |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/tenders/{id}/audit/` | Per-tender audit events |
| `GET`  | `/api/tenders/{id}/audit/verify` | Verify hash chain integrity |
| `GET`  | `/api/audit/` | Global audit trail (Admin/Audit Reviewer) |

---

## Key Design Decisions

- **AI extraction ≠ final verdict**: GPT-4o extracts structured evidence; a deterministic Python rule engine makes all eligibility decisions. Reproducible and legally defensible.
- **Confidence gating**: Extractions with confidence < 0.60 are escalated to `NEEDS_MANUAL_REVIEW` — no bidder is silently disqualified.
- **Submission locking**: Bidders must explicitly confirm their submission via a modal dialog. After confirmation, documents are immutable. This prevents post-evaluation manipulation.
- **KYC auto-trigger**: Submission confirmation automatically runs GSTIN, PAN, and debarment verification in the background. Results surface as a KYC badge in the officer view and in the Evidence drawer (shows existing result instead of prompting re-run).
- **Bulk evaluation**: Officers can trigger evaluation for all registered bidders with one button / one API call.
- **Bulk document upload**: Bidders can upload multiple files at once; each is OCR-processed individually.
- **Reviewer notes**: Officers can attach inline notes to each criterion during the review/approval step. Notes are persisted and visible in the criterion card.
- **Evidence citations in reviews**: Review task cards include collapsible evidence citations (source doc, page, extracted text, OCR confidence) to enable evidence-grounded overrides.
- **Streaming PDF reports**: Reports are generated on-demand and streamed directly — no disk I/O. Export includes Source Document and Page columns for each criterion verdict.
- **Immutable audit trail**: `audit_events` table is append-only with SHA-256 hash chaining. Tamper-evident, verifiable by any external auditor. Audit event payloads are rendered in human-readable format per event type (not raw JSON).
- **Document ownership**: Bidder documents can only be uploaded by the bidder's own account. Officers have zero write access to bidder document storage — enforced at the API layer.
- **Dashboard live stats**: `/api/dashboard/stats` aggregates real-time bidder verdict distribution (Eligible / Not Eligible / Needs Review / Pending), open review task count, and evaluation progress across all tenders.
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
├── models/tables.py      # All ORM models (10 tables)
├── api/
│   ├── auth.py           # Register, login, JWT, require_role() guard
│   ├── tenders.py        # Upload (Senior+ only), criteria approve, reviewer notes
│   ├── bidders.py        # Self-register, single/bulk doc upload, confirm-submission, evaluate-all
│   ├── verdicts.py       # Evaluation matrix, verdict override (Senior+ only)
│   ├── reviews.py        # Review queue with evidence citations; resolve locked to Senior+ only
│   ├── global_reviews.py # Cross-tender review queue
│   ├── reports.py        # Streaming PDF report generation (Source Doc + Page columns)
│   ├── audit.py          # Per-tender audit trail + hash-chain verification
│   ├── global_audit.py   # Global audit trail
│   ├── dashboard.py      # Dashboard stats endpoint (verdict distribution, open reviews)
│   ├── bidder_portal.py  # BIDDER-only portal views
│   └── kyc.py            # GSTIN, PAN, debarment, full-check endpoints
├── services/             # tender_parser, ocr_engine, extraction_service, rule_engine, audit_service, kyc_service
├── rules/                # Deterministic rule functions: financial, technical, compliance
├── prompts/              # Jinja2 prompt templates: criterion_extract.j2, evidence_extract.j2
├── alembic/              # Alembic env + migration versions
└── storage/              # Local file storage (tenders/, bidders/)

frontend/
├── app/
│   ├── page.tsx          # Public landing page
│   ├── login/            # Sign-in with role legend + clickable demo credentials
│   ├── register/         # Account creation with role selector (5 roles)
│   └── (dashboard)/      # All authenticated views (role-gated)
│       ├── dashboard/    # Live stats: verdict distribution chart + bidder summary row
│       ├── tenders/      # Tender list + tender detail (criteria + bidder table)
│       ├── reviews/      # Manual review queue with evidence citation panel
│       └── audit/        # Audit trail with human-readable per-event-type payloads
├── components/
│   ├── layout/           # Sidebar (role-aware) + Header (role badge)
│   ├── dashboard/        # Metric cards + pipeline chart + verdict distribution chart
│   ├── tenders/          # Tender cards + upload modal + criterion cards (with reviewer notes)
│   ├── matrix/           # Bidder comparison matrix + evidence drawer (KYC status aware)
│   ├── reviews/          # Review task cards (with collapsible evidence citations)
│   ├── audit/            # Audit timeline (human-readable payload renderers per event type)
│   └── ui/               # Badge · skeleton · empty-state · confidence-meter · modal (ConfirmModal)
└── lib/
    ├── api/              # Typed API wrappers: tenders, bidders, verdicts, reviews, reports, kyc, dashboard
    ├── stores/           # Zustand auth store
    ├── types/            # TypeScript interfaces matching backend models
    └── utils.ts          # Currency · date · confidence formatters · rule name map
```

---

## Database Migrations

All migrations live in `backend/alembic/versions/`. Key migrations:

| Migration | Change |
|-----------|--------|
| Initial | All core tables: users, tenders, tender_criteria, bidders, bidder_documents, bidder_evidence, criterion_verdicts, review_tasks, reports, audit_events |
| a3c7e2f91b04 | `reviewer_notes TEXT` column on `tender_criteria` |

To create a new migration after model changes:
```bash
python -m alembic -c backend/alembic.ini revision --autogenerate -m "description"
python -m alembic -c backend/alembic.ini upgrade head
```

---

## Gotchas

- **bcrypt must be 4.0.1** — passlib is incompatible with bcrypt 5.x; login collapses silently.
- `DATABASE_URL` from Replit already contains `?ssl` — no extra connect_args needed.
- OCR for scanned PDFs uses GPT-4o Vision — costs API credits per page.
- Alembic ini file is at `backend/alembic.ini`, not the project root.
- Criterion verdicts have a unique constraint on `(bidder_id, criterion_id)` — re-running evaluation updates existing records.
- Bidder document upload is locked to the BIDDER account that owns the profile.
- Document deletion is blocked after `submission_confirmed = true`.
- The `evaluate-all` endpoint queues evaluations for all bidders; `triggered_count` in the response shows how many were queued.
- Dashboard verdict chart requires at least one completed evaluation to show data; it auto-refreshes every 30 seconds.
