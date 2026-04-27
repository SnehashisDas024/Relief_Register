"""
services/feedback_service.py — EMA weight drift + volunteer rating update.
"""
import json
import os

import redis as redis_lib

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_r = redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)

EMA_ALPHA = 0.05  # smoothing factor — slow drift


def process_feedback(task_id: int, rating: float, comment: str = ""):
    """
    1. Load task → need → volunteer
    2. Update volunteer rolling rating
    3. Update category_feedback EMA weights
    4. Push updated weights to Redis
    5. Recompute priority percentile ranks
    """
    from app.extensions import db
    from app.models.task import Task
    from app.models.need import Need
    from app.models.volunteer import Volunteer
    from app.models.category_feedback import CategoryFeedback

    task = Task.query.get(task_id)
    if not task:
        return

    # ── Update volunteer rating ──────────────────────────────────────
    vol = task.volunteer
    if vol:
        if vol.rating_count == 0:
            vol.rating = rating
        else:
            vol.rating = (vol.rating * vol.rating_count + rating) / (vol.rating_count + 1)
        vol.rating_count += 1

    # ── Update category feedback via EMA ────────────────────────────
    need = task.need
    category = need.category if need else "Other"

    fb = CategoryFeedback.query.filter_by(category=category).first()
    if not fb:
        fb = CategoryFeedback(
            category=category,
            avg_rating=rating,
            avg_resolution_time=task.resolution_time_hrs or 0.0,
            sample_count=1,
        )
        db.session.add(fb)
    else:
        fb.avg_rating = (1 - EMA_ALPHA) * fb.avg_rating + EMA_ALPHA * rating
        if task.resolution_time_hrs:
            fb.avg_resolution_time = (
                (1 - EMA_ALPHA) * fb.avg_resolution_time
                + EMA_ALPHA * task.resolution_time_hrs
            )
        fb.sample_count += 1
        # Nudge weights: high rating → trust severity more; low rating → trust gap more
        if rating >= 4.0:
            fb.weight_severity = min(0.70, fb.weight_severity + 0.01)
            fb.weight_gap = max(0.15, fb.weight_gap - 0.005)
            fb.weight_frequency = max(0.15, fb.weight_frequency - 0.005)
        elif rating <= 2.0:
            fb.weight_gap = min(0.60, fb.weight_gap + 0.01)
            fb.weight_severity = max(0.15, fb.weight_severity - 0.005)
            fb.weight_frequency = max(0.15, fb.weight_frequency - 0.005)

    db.session.commit()

    # ── Push weights to Redis ────────────────────────────────────────
    if fb:
        weights_payload = json.dumps({
            "severity": fb.weight_severity,
            "frequency": fb.weight_frequency,
            "gap": fb.weight_gap,
        })
        _r.set(f"sra:weights:{category}", weights_payload, ex=2592000)  # 30 days

    # ── Recompute relative percentile ranks ──────────────────────────
    from app.modules.priority import recompute_relative_ranks
    recompute_relative_ranks()
