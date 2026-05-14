import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.database import Base, engine
from backend.api import auth, tenders, bidders, verdicts, reviews, reports, audit, global_reviews, global_audit, bidder_portal, kyc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

Path(settings.storage_base_path).mkdir(parents=True, exist_ok=True)
(Path(settings.storage_base_path) / "tenders").mkdir(parents=True, exist_ok=True)
(Path(settings.storage_base_path) / "bidders").mkdir(parents=True, exist_ok=True)
(Path(settings.storage_base_path) / "reports").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    description=(
        "AI-Powered Tender Evaluation & Bidder Eligibility Platform. "
        "Criterion-level explainability, hybrid AI + rule-based evaluation, "
        "immutable audit trail."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(tenders.router, prefix=API_PREFIX)
app.include_router(bidders.router, prefix=API_PREFIX)
app.include_router(verdicts.router, prefix=API_PREFIX)
app.include_router(reviews.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(global_reviews.router, prefix=API_PREFIX)
app.include_router(global_audit.router, prefix=API_PREFIX)
app.include_router(bidder_portal.router, prefix=API_PREFIX)
app.include_router(kyc.router, prefix=API_PREFIX)



@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_title, "version": settings.app_version}


@app.on_event("startup")
def on_startup():
    logger.info(f"Starting {settings.app_title} v{settings.app_version}")
    logger.info(f"Storage path: {settings.storage_base_path}")
    logger.info(f"LLM model: {settings.llm_model}")
