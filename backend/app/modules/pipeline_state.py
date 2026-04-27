"""
modules/pipeline_state.py — Redis TTL tracking for ingestion pipeline stages.
"""
import os
import json
from datetime import datetime, timezone

import redis as redis_lib

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_r = redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)

TTL_SECONDS = 7 * 24 * 3600  # 7 days


def set_stage(source_id: str, stage: str, meta: dict = None):
    """Record current pipeline stage for a source_id."""
    key = f"sra:pipeline:{source_id}"
    payload = {
        "stage": stage,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "meta": meta or {},
    }
    try:
        _r.set(key, json.dumps(payload), ex=TTL_SECONDS)
    except Exception as e:
        print(f"[PipelineState] set_stage error: {e}")


def get_stage(source_id: str) -> dict:
    """Retrieve current pipeline stage. Returns None if not found."""
    key = f"sra:pipeline:{source_id}"
    try:
        val = _r.get(key)
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None
