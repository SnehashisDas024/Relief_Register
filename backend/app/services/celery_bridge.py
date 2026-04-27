"""
backend/app/services/celery_bridge.py

A single import point for Celery tasks within the Flask app package.
Using a bridge prevents sys.path manipulation from being scattered across files.
"""
import os
import sys

# Ensure backend/ root is on path so `from celery_worker import X` resolves
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from celery_worker import (       # noqa: E402
    task_process_upload,
    task_send_notification,
    task_update_feedback,
    task_recompute_priorities,
    task_expire_stale_matches,
)

__all__ = [
    "task_process_upload",
    "task_send_notification",
    "task_update_feedback",
    "task_recompute_priorities",
    "task_expire_stale_matches",
]
