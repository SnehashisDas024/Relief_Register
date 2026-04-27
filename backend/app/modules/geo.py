"""
modules/geo.py — Pure Python Haversine geo math. No PostGIS needed.
"""
import math
from typing import List, Tuple

EARTH_RADIUS_KM = 6371.0
MIN_RADIUS_KM   = 10.0
MAX_RADIUS_KM   = 150.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Return great-circle distance in km between two GPS points.
    O(1), pure Python — no external deps.
    """
    r = EARTH_RADIUS_KM
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def get_search_radius(urgency_score: float) -> float:
    """
    Inversely scale radius with urgency:
      urgency=1.0 → 10 km   (emergency — get someone NOW)
      urgency=0.0 → 150 km  (find best person)
    Linear interpolation.
    """
    u = min(max(urgency_score, 0.0), 1.0)
    return MAX_RADIUS_KM - u * (MAX_RADIUS_KM - MIN_RADIUS_KM)


def compute_geo_weight(distance_km: float, max_radius_km: float) -> float:
    """
    Linearly decay from 1.0 (at distance=0) to 0.0 (at distance=max_radius).
    Returns 0 if beyond max radius.
    """
    if max_radius_km <= 0:
        return 0.0
    return max(0.0, 1.0 - (distance_km / max_radius_km))


def geo_filter(
    need_lat: float,
    need_lng: float,
    radius_km: float,
    volunteers: list,
) -> List[Tuple[object, float]]:
    """
    Filter volunteers to those within radius_km of the need.
    Returns list of (volunteer, distance_km) tuples, sorted by distance.
    volunteers: list of Volunteer model objects (must have .lat and .lng).
    """
    result = []
    for vol in volunteers:
        if vol.lat is None or vol.lng is None:
            continue
        dist = haversine(need_lat, need_lng, vol.lat, vol.lng)
        if dist <= radius_km:
            result.append((vol, dist))
    result.sort(key=lambda x: x[1])
    return result
