"""
modules/priority.py — 7-layer urgency score engine + Redis priority queue.
No Flask, no DB. Pure Python + Redis.
"""
import math
import os
import json
from datetime import datetime, timezone
from typing import Optional

import redis as redis_lib

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_r = redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)

QUEUE_KEY = "sra:priority:active"

# ── Category-aware default weights ─────────────────────────────────
CATEGORY_WEIGHTS = {
    "Medical":       {"severity": 0.60, "frequency": 0.20, "gap": 0.20},
    "Food":          {"severity": 0.40, "frequency": 0.35, "gap": 0.25},
    "Shelter":       {"severity": 0.35, "frequency": 0.30, "gap": 0.35},
    "Education":     {"severity": 0.25, "frequency": 0.40, "gap": 0.35},
    "Mental Health": {"severity": 0.45, "frequency": 0.20, "gap": 0.35},
    "Construction":  {"severity": 0.30, "frequency": 0.25, "gap": 0.45},
    "Other":         {"severity": 0.40, "frequency": 0.30, "gap": 0.30},
}

# ── SLA hours per category ──────────────────────────────────────────
SLA_HOURS = {
    "Medical": 4, "Food": 8, "Shelter": 12,
    "Education": 48, "Mental Health": 24,
    "Construction": 72, "Other": 24,
}

# ── Source confidence multipliers ──────────────────────────────────
SOURCE_CONFIDENCE = {
    "manual":    1.00,
    "api":       0.95,
    "csv":       0.90,
    "ocr_image": 0.65,
}


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _get_weights(category: str) -> dict:
    """Get weights: try Redis (EMA-updated) first, fall back to defaults."""
    redis_key = f"sra:weights:{category}"
    try:
        cached = _r.get(redis_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    return CATEGORY_WEIGHTS.get(category, CATEGORY_WEIGHTS["Other"])


def compute_urgency_score(
    severity: int,
    frequency: int,
    volunteers_needed: int,
    volunteers_available: int,
    category: str = "Other",
    source_type: str = "manual",
    reporter_trust: float = 1.0,
    hours_open: float = 0.0,
) -> float:
    """
    Full 7-layer urgency formula:
      S  = trust-weighted normalised severity
      F  = log-scaled report frequency
      G  = volunteer deficit ratio
      base = weighted sum of S, F, G (category-aware weights)
      time_bonus = sigmoid SLA escalation
      confidence = source type multiplier
      final = min(1.0, (base + time_bonus) * confidence)
    """
    weights = _get_weights(category)

    # Layer 1 — Trust-weighted severity (0-1)
    S = (min(max(severity, 1), 10) / 10.0) * min(max(reporter_trust, 0.1), 1.0)

    # Layer 2 — Log-scaled frequency (0-1)
    F = math.log(max(frequency, 1) + 1) / math.log(101)

    # Layer 3 — Volunteer deficit ratio (0-1)
    if volunteers_needed <= 0:
        G = 0.5
    elif volunteers_available <= 0:
        G = 1.0
    else:
        G = min(1.0, (volunteers_needed - volunteers_available) / volunteers_needed)

    # Layer 4 — Category-weighted base score
    base = (
        weights["severity"] * S +
        weights["frequency"] * F +
        weights["gap"] * G
    )

    # Layer 5 — SLA-aware sigmoid time escalation
    sla = SLA_HOURS.get(category, 24)
    if hours_open > 0:
        time_bonus = _sigmoid((hours_open / sla) * 10 - 5) * 0.25
    else:
        time_bonus = 0.0

    # Layer 6 — Source confidence
    confidence = SOURCE_CONFIDENCE.get(source_type, 0.80)

    # Layer 7 — Final composite score
    final = min(1.0, (base + time_bonus) * confidence)
    return round(final, 4)


# ── Redis sorted set operations ─────────────────────────────────────

def add_to_priority_queue(need_id: int, score: float):
    """ZADD O(log n)."""
    try:
        _r.zadd(QUEUE_KEY, {str(need_id): score})
    except Exception as e:
        print(f"[Priority] Redis ZADD error: {e}")


def remove_from_queue(need_id: int):
    try:
        _r.zrem(QUEUE_KEY, str(need_id))
    except Exception:
        pass


def get_top_needs(k: int = 20) -> list:
    """ZRANGE DESC O(log n + k) — returns list of (need_id, score)."""
    try:
        return [(int(nid), float(score))
                for nid, score in _r.zrange(QUEUE_KEY, 0, k - 1, withscores=True, desc=True)]
    except Exception:
        return []


def recompute_relative_ranks():
    """
    Recalculate percentile rank for each need in the active queue
    and store as Redis string with 15-min TTL.
    Called by Celery Beat every 15 minutes.
    """
    try:
        items = _r.zrange(QUEUE_KEY, 0, -1, withscores=True)
        total = len(items)
        if not total:
            return
        for rank, (nid, score) in enumerate(reversed(items)):
            percentile = round((rank / total) * 100, 1)
            _r.set(f"sra:priority:{nid}:percentile", percentile, ex=900)
    except Exception as e:
        print(f"[Priority] recompute error: {e}")
