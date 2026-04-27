"""tests/test_priority.py — Unit tests for priority engine."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.modules.priority import compute_urgency_score


def test_medical_high_severity_scores_high():
    score = compute_urgency_score(
        severity=10, frequency=5, volunteers_needed=3,
        volunteers_available=0, category="Medical", source_type="manual"
    )
    assert score > 0.75, f"Expected > 0.75, got {score}"


def test_education_low_severity_scores_lower():
    score = compute_urgency_score(
        severity=2, frequency=1, volunteers_needed=1,
        volunteers_available=1, category="Education", source_type="manual"
    )
    assert score < 0.50, f"Expected < 0.50, got {score}"


def test_ocr_source_penalised():
    s_manual = compute_urgency_score(5, 2, 2, 0, "Food", "manual")
    s_ocr    = compute_urgency_score(5, 2, 2, 0, "Food", "ocr_image")
    assert s_ocr < s_manual, "OCR source should score lower than manual"


def test_score_bounded_0_to_1():
    for sev in [1, 5, 10]:
        score = compute_urgency_score(sev, 10, 5, 0, "Medical", "manual", hours_open=100)
        assert 0.0 <= score <= 1.0, f"Score out of bounds: {score}"


def test_no_gap_reduces_score():
    with_gap    = compute_urgency_score(7, 3, 5, 0, "Shelter", "manual")
    without_gap = compute_urgency_score(7, 3, 5, 5, "Shelter", "manual")
    assert with_gap > without_gap, "Gap should increase urgency"
