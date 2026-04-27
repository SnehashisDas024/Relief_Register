"""
backend/celery_worker.py — Celery app definition + all async task definitions.

Run:
  cd backend
  celery -A celery_worker.celery worker --loglevel=info
  celery -A celery_worker.celery beat  --loglevel=info
"""
import eventlet
eventlet.monkey_patch()

import os
import sys

# Make sure `backend/` is on sys.path so `from app.X import Y` works
sys.path.insert(0, os.path.dirname(__file__))

from celery import Celery
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

BROKER_URL = os.environ.get("CELERY_BROKER_URL", os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
RESULT_URL  = os.environ.get("CELERY_RESULT_URL",  os.environ.get("REDIS_URL", "redis://localhost:6379/0"))

celery = Celery("sra", broker=BROKER_URL, backend=RESULT_URL)
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "recompute-priorities-every-15min": {
            "task": "celery_worker.task_recompute_priorities",
            "schedule": 900.0,
        },
        "expire-stale-matches-every-30min": {
            "task": "celery_worker.task_expire_stale_matches",
            "schedule": 1800.0,
        },
    },
)


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline tasks
# ─────────────────────────────────────────────────────────────────────────────

@celery.task(bind=True, max_retries=3, default_retry_delay=30,
             autoretry_for=(Exception,), name="celery_worker.task_process_upload")
def task_process_upload(self, source_id: str, file_url: str, file_type: str, uploader_id: int):
    """Full ingestion pipeline: download → OCR/parse → clean → classify → score → DB → Redis."""
    from app.services.ingestion_service import run_pipeline
    run_pipeline(source_id, file_url, file_type, uploader_id)


@celery.task(bind=True, max_retries=3, default_retry_delay=60,
             autoretry_for=(Exception,), name="celery_worker.task_send_notification")
def task_send_notification(self, user_id: int, message: str, notif_type: str = "task",
                            email: str = None, phone: str = None):
    from app.services.notification_service import dispatch_notification
    dispatch_notification(user_id, message, notif_type, email, phone)


@celery.task(bind=True, max_retries=2, default_retry_delay=30,
             autoretry_for=(Exception,), name="celery_worker.task_update_feedback")
def task_update_feedback(self, task_id: int, rating: float, comment: str = ""):
    from app.services.feedback_service import process_feedback
    process_feedback(task_id, rating, comment)


@celery.task(name="celery_worker.task_recompute_priorities")
def task_recompute_priorities():
    from app.modules.priority import recompute_relative_ranks
    recompute_relative_ranks()


@celery.task(name="celery_worker.task_expire_stale_matches")
def task_expire_stale_matches():
    """Cross-check DB and remove stale needs from Redis priority queue."""
    import redis as redis_lib
    r = redis_lib.Redis.from_url(
        os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        decode_responses=True,
    )
    r.expire("sra:priority:active", 86400 * 7)
