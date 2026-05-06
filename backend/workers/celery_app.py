import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "tendergraph",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "backend.workers.ocr_worker",
        "backend.workers.extract_worker",
        "backend.workers.rule_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "backend.workers.ocr_worker.*": {"queue": "ocr"},
        "backend.workers.extract_worker.*": {"queue": "extract"},
        "backend.workers.rule_worker.*": {"queue": "rules"},
    },
)
