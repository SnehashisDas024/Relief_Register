"""tests/test_cleaning.py — Unit tests for data cleaning module."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pandas as pd
import pytest
from app.modules.cleaning import clean_dataframe, _normalise_category


def make_df(**kwargs):
    base = {"description": ["Need medical help urgently"]}
    base.update(kwargs)
    return pd.DataFrame(base)


def test_drops_duplicates():
    df = pd.DataFrame({"description": ["dup", "dup", "unique"]})
    out = clean_dataframe(df)
    assert len(out) == 2


def test_missing_description_raises():
    df = pd.DataFrame({"severity": [5]})
    with pytest.raises(ValueError):
        clean_dataframe(df)


def test_severity_clipped():
    df = make_df(severity=[99])
    out = clean_dataframe(df)
    assert out["severity"].iloc[0] == 10


def test_category_normalised():
    df = make_df(category=["MEDICAL"])
    out = clean_dataframe(df)
    assert out["category"].iloc[0] == "Medical"


def test_keyword_category_medical():
    assert _normalise_category("hospital emergency") == "Medical"


def test_keyword_category_food():
    assert _normalise_category("hunger relief") == "Food"


def test_unknown_category_returns_other():
    assert _normalise_category("xyz123") == "Other"


def test_strips_whitespace():
    df = make_df(location=["  Kolkata  "])
    out = clean_dataframe(df)
    assert out["location"].iloc[0] == "Kolkata"


def test_empty_df_raises():
    with pytest.raises(ValueError):
        clean_dataframe(pd.DataFrame())
