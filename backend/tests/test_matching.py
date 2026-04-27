"""tests/test_matching.py — Unit tests for matching engine."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.modules.matching import get_dynamic_weights, _cosine_similarity


def test_weights_high_urgency_geo_dominates():
    w = get_dynamic_weights(1.0)
    assert w["geo"] > w["skill"]


def test_weights_low_urgency_skill_dominates():
    w = get_dynamic_weights(0.0)
    assert w["skill"] > w["geo"]


def test_weights_sum_to_one():
    for u in [0.0, 0.25, 0.5, 0.75, 1.0]:
        w = get_dynamic_weights(u)
        assert abs(w["skill"] + w["geo"] - 1.0) < 0.001


def test_cosine_identical_vectors():
    assert abs(_cosine_similarity([1,1,1], [1,1,1]) - 1.0) < 0.001


def test_cosine_orthogonal_vectors():
    assert abs(_cosine_similarity([1,0,0], [0,1,0])) < 0.001


def test_cosine_empty_returns_zero():
    assert _cosine_similarity([], [1,2,3]) == 0.0


def test_cosine_different_lengths():
    # Should not raise — handles mismatched lengths
    score = _cosine_similarity([1,1], [1,1,1])
    assert 0.0 <= score <= 1.0
