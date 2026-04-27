"""
modules/matching.py — Cosine similarity + dynamic geo weighting.
No Flask, no DB.
"""
import os
import json
import pickle
from typing import List, Dict, Any, Optional

import numpy as np

from app.modules.geo import get_search_radius, compute_geo_weight, geo_filter, haversine

import redis as redis_lib
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_r = redis_lib.Redis.from_url(REDIS_URL, decode_responses=False)  # bytes for pickle


def _cosine_similarity(a: list, b: list) -> float:
    if not a or not b:
        return 0.0
    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    # Align lengths
    min_len = min(len(va), len(vb))
    va, vb = va[:min_len], vb[:min_len]
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def get_dynamic_weights(urgency_score: float) -> Dict[str, float]:
    """
    urgency=1.0 → skill=0.40, geo=0.60  (proximity dominates)
    urgency=0.0 → skill=0.80, geo=0.20  (skill dominates)
    Linear interpolation.
    """
    u = min(max(urgency_score, 0.0), 1.0)
    skill_w = 0.80 - 0.40 * u
    geo_w   = 0.20 + 0.40 * u
    return {"skill": round(skill_w, 4), "geo": round(geo_w, 4)}


def _get_volunteer_matrix(volunteers: list):
    """
    Return (matrix, ids) from Redis cache or build fresh.
    matrix shape: (n_volunteers, vector_len)
    """
    cache_key = b"sra:matching:volunteer_matrix"
    try:
        cached = _r.get(cache_key)
        if cached:
            return pickle.loads(cached)
    except Exception:
        pass

    ids = [v.id for v in volunteers]
    vecs = [v.skills_vector or [] for v in volunteers]
    max_len = max((len(v) for v in vecs), default=0)
    if max_len == 0:
        return None

    matrix = np.zeros((len(vecs), max_len), dtype=float)
    for i, vec in enumerate(vecs):
        for j, val in enumerate(vec[:max_len]):
            matrix[i][j] = float(val)

    payload = (matrix, ids)
    try:
        _r.set(cache_key, pickle.dumps(payload), ex=3600)
    except Exception:
        pass
    return payload


def match_volunteers_to_need(
    need,
    all_volunteers: list,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    3-gate pipeline:
      Gate 1 — availability filter
      Gate 2 — dynamic geo filter (cuts 80-90% of candidates)
      Gate 3 — cosine similarity on remaining subset
    Returns top_k sorted match dicts.
    """
    urgency = need.urgency_score or 0.5
    weights = get_dynamic_weights(urgency)
    radius = get_search_radius(urgency)

    # Gate 1 — available only
    available = [v for v in all_volunteers if v.is_available]
    if not available:
        return []

    # Gate 2 — geo filter
    if need.lat and need.lng:
        geo_candidates = geo_filter(need.lat, need.lng, radius, available)
        # If fewer than 5 found, expand radius iteratively (fallback)
        if len(geo_candidates) < 5:
            for expanded_radius in [radius * 1.5, radius * 2.5, MAX_RADIUS]:
                geo_candidates = geo_filter(need.lat, need.lng, expanded_radius, available)
                if len(geo_candidates) >= 3:
                    radius = expanded_radius
                    break
    else:
        geo_candidates = [(v, 0.0) for v in available]

    if not geo_candidates:
        return []

    # Gate 3 — cosine similarity
    need_vec = need.skills_vector or []
    results = []

    for vol, dist_km in geo_candidates:
        vol_vec = vol.skills_vector or []
        skill_score = _cosine_similarity(need_vec, vol_vec) if need_vec and vol_vec else 0.5
        geo_score = compute_geo_weight(dist_km, radius)

        final_score = weights["skill"] * skill_score + weights["geo"] * geo_score
        # Value multiplier for high-impact needs
        if urgency > 0.85:
            final_score = min(1.0, final_score * 1.15)

        results.append({
            "volunteer_id": vol.id,
            "name": vol.user.name if vol.user else "Unknown",
            "skills": vol.skills or [],
            "distance_km": round(dist_km, 2),
            "skill_score": round(skill_score, 4),
            "geo_score": round(geo_score, 4),
            "final_score": round(final_score, 4),
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results[:top_k]


MAX_RADIUS = 200.0
