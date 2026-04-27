"""tests/test_geo.py — Unit tests for geo module."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.modules.geo import haversine, get_search_radius, compute_geo_weight, geo_filter


def test_haversine_same_point():
    assert haversine(22.5, 88.3, 22.5, 88.3) == 0.0


def test_haversine_known_distance():
    # Kolkata to Delhi ≈ 1305 km
    d = haversine(22.5726, 88.3639, 28.6139, 77.2090)
    assert 1280 < d < 1330, f"Expected ~1305km, got {d:.1f}"


def test_radius_high_urgency():
    r = get_search_radius(1.0)
    assert r == 10.0


def test_radius_low_urgency():
    r = get_search_radius(0.0)
    assert r == 150.0


def test_radius_midpoint():
    r = get_search_radius(0.5)
    assert 70 < r < 90


def test_geo_weight_at_zero():
    assert compute_geo_weight(0.0, 50.0) == 1.0


def test_geo_weight_at_max():
    assert compute_geo_weight(50.0, 50.0) == 0.0


def test_geo_weight_midpoint():
    w = compute_geo_weight(25.0, 50.0)
    assert abs(w - 0.5) < 0.01


def test_geo_filter_excludes_far():
    class FakeVol:
        lat = 22.6; lng = 88.4  # ~12 km from 22.5726, 88.3639
    vols = [FakeVol()]
    result = geo_filter(22.5726, 88.3639, 5.0, vols)
    assert result == []


def test_geo_filter_includes_near():
    class FakeVol:
        lat = 22.58; lng = 88.37  # ~1 km away
    vols = [FakeVol()]
    result = geo_filter(22.5726, 88.3639, 5.0, vols)
    assert len(result) == 1
