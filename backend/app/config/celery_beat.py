"""
backend/app/config/celery_beat.py — Celery Beat periodic task schedule.
Imported by backend/celery_worker.py.
"""

BEAT_SCHEDULE = {
    "recompute-priorities-every-15min": {
        "task": "celery_worker.task_recompute_priorities",
        "schedule": 900.0,   # 15 minutes
    },
    "expire-stale-matches-every-30min": {
        "task": "celery_worker.task_expire_stale_matches",
        "schedule": 1800.0,  # 30 minutes
    },
}
