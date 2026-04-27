"""
modules/dead_letter.py — Store failed ingestion records.
Writes to DB via SQLAlchemy app context + bumps Redis counter.
"""
import os
import redis as redis_lib

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_r = redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)


def send_to_dead_letter(source_id: str, reason: str, raw_data: dict = None):
    """
    Persist a failed ingestion record to the DB and update the Redis counter.
    Must be called from within a Flask app context (Celery task has one).
    """
    try:
        from app.extensions import db
        from app.models.failed_ingestion import FailedIngestion
        record = FailedIngestion(
            source_id=source_id,
            reason=reason,
            raw_data=raw_data or {},
        )
        db.session.add(record)
        db.session.commit()
        _r.incr("sra:admin:dead_letter_count")
    except Exception as e:
        print(f"[DeadLetter] Failed to persist dead letter: {e}")
