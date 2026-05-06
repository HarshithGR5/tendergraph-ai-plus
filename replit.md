# TenderGraph AI+

AI-Powered Tender Evaluation & Bidder Eligibility Platform for government procurement — extracts eligibility criteria from tender documents, evaluates bidder submissions using GPT-4o OCR + a deterministic rule engine, and produces criterion-level explainable verdicts with an immutable audit trail.

## Run & Operate

- **Start backend**: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- **Run migrations**: `python -m alembic -c backend/alembic.ini upgrade head`
- **Create new migration**: `python -m alembic -c backend/alembic.ini revision --autogenerate -m "description"`
- **Start frontend**: `cd frontend && npm run dev -- --port 5000`
- **API docs**: `http://localhost:8000/api/docs`
- **Health check**: `GET /api/health`

Required env vars:
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `OPENAI_API_KEY` — GPT-4o for OCR and LLM extraction tasks
- `SECRET_KEY` — JWT signing key (defaults to changeme-in-production-please)

## Stack

- **Runtime**: Python 3.11 + Node.js 20
- **API**: FastAPI 0.115 + Uvicorn
- **ORM**: SQLAlchemy 2.0 + Alembic migrations
- **DB**: PostgreSQL (Replit managed)
- **Auth**: JWT (python-jose) + bcrypt==4.0.1 (pinned — must stay at 4.0.1 or login collapses)
- **LLM/OCR**: GPT-4o (OpenAI) via structured JSON output mode
- **PDF parsing**: PyMuPDF + pdfplumber (native), GPT-4o Vision (scanned)
- **Reports**: ReportLab PDF generation
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **State**: Zustand + React Query
- **Charts**: Recharts

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
frontend/
├── app/
│   ├── page.tsx          # Public landing page (hero, features, roles, workflow)
│   ├── login/            # Sign-in page with role legend + clickable demo credentials
│   ├── register/         # Account creation with visual role selector (4 roles)
│   └── (dashboard)/      # All authenticated views
├── components/
│   ├── layout/           # Sidebar (role-aware nav) + Header (role badge)
│   ├── dashboard/        # Metric cards + charts
│   ├── tenders/          # Tender cards + upload modal + criterion cards
│   ├── matrix/           # Bidder comparison matrix + evidence drawer
│   ├── reviews/          # Review task cards
│   ├── audit/            # Audit timeline
│   └── ui/               # Badge · skeleton · empty-state · confidence-meter
└── lib/
    ├── api/              # Typed API wrappers for every endpoint
    ├── stores/           # Zustand auth store
    ├── types/            # TypeScript interfaces matching backend models
    └── utils.ts          # Currency · date · confidence formatters
```

## Architecture decisions

- **AI extraction ≠ final verdict**: GPT-4o extracts structured evidence; a deterministic Python rule engine makes all eligibility decisions. This separation ensures reproducibility and legal defensibility.
- **Confidence gating**: Any extraction with confidence < 0.60 is escalated to `NEEDS_MANUAL_REVIEW` — no bidder is silently disqualified.
- **Immutable audit trail**: `audit_events` table is append-only with SHA-256 hash chaining across every row. Tamper-evident.
- **Local storage first**: All uploaded documents stored to `./backend/storage/` filesystem. No cloud object storage dependency.
- **bcrypt pinned at 4.0.1**: passlib[bcrypt] with bcrypt==4.0.1 is required for login to work. Do not upgrade bcrypt.
- **API proxy via Next.js rewrites**: All `/api/*` calls from the frontend proxy through Next.js to `localhost:8000` — works in both dev and Replit preview.

## Product

Public pages:
- **Landing page** (`/`) — Hero, features, workflow steps, 4 role descriptions, CTA
- **Login** (`/login`) — Sign in with role legend panel + clickable demo credentials auto-fill
- **Register** (`/register`) — Account creation with visual role selector (4 cards with permissions)

Five evaluation workflow views (authenticated):
1. **Tender Overview** — upload tender, review/approve extracted criteria
2. **Bidder Comparison Matrix** — colour-coded verdict matrix across all bidders × criteria
3. **Individual Bidder Report** — per-bidder criterion-by-criterion evaluation with evidence chain
4. **Manual Review Queue** — task board for NEEDS_MANUAL_REVIEW cases with override logging
5. **Audit Trail Viewer** — chronological immutable event log with hash-chain verification

## User Roles (from doc)

| Role | Nav visible | Key capability |
|------|------------|----------------|
| PROCUREMENT_OFFICER | Dashboard, Tenders, Review Queue | Upload tenders, run evaluations |
| SENIOR_OFFICER | + Review Queue | Approve criteria, override verdicts |
| SYSTEM_ADMIN | + Audit Trail, Settings | User management, full access |
| AUDIT_REVIEWER | Audit Trail only | Read-only, hash-chain verification |

## Gotchas

- **bcrypt must be 4.0.1** — passlib is incompatible with bcrypt 5.x, login collapses silently.
- The `DATABASE_URL` from Replit already contains `?ssl` — no extra connect_args needed.
- OCR for scanned PDFs uses GPT-4o Vision — costs API credits per page.
- Alembic ini file is at `backend/alembic.ini`, not the project root.
- Criterion verdicts have a unique constraint on `(bidder_id, criterion_id)` — re-running evaluation updates existing records.

## Pointers

- DB schema: `backend/models/tables.py`
- API contracts: `http://localhost:8000/api/docs`
- LLM prompts: `backend/prompts/criterion_extract.j2`, `backend/prompts/evidence_extract.j2`
- Confidence thresholds: `backend/config.py`
- GitHub README: `README.md`
