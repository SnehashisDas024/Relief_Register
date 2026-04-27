"""
backend/app/modules/cleaning.py — Pure Pandas data cleaning + OCR text parsing.
No Flask, no DB. Fully unit-testable in isolation.
"""
import re
import json
import pandas as pd

REQUIRED_COLUMNS = {"description"}
VALID_CATEGORIES = {
    "Medical", "Food", "Shelter", "Education",
    "Mental Health", "Construction", "Other",
}


# ─────────────────────────────────────────────────────────────────────────────
# Primary public functions
# ─────────────────────────────────────────────────────────────────────────────

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Full cleaning pipeline for structured tabular data (CSV / Excel / parsed OCR):
      1. Normalise column names (strip, lowercase, underscores)
      2. Drop exact duplicate rows
      3. Validate required columns present
      4. Strip whitespace from all text columns
      5. Fill missing values with safe defaults
      6. Normalise category values (fuzzy + keyword match)
      7. Clamp numeric fields to valid ranges
      8. Drop rows with empty or trivially short descriptions
      9. Reset index

    Returns cleaned DataFrame. Raises ValueError on critical failures.
    """
    if df is None or df.empty:
        raise ValueError("Received empty DataFrame — nothing to process")

    # 1 — Normalise column names
    df.columns = [
        re.sub(r"\s+", "_", c.strip().lower())
        for c in df.columns
    ]

    # 2 — Drop full duplicates
    df = df.drop_duplicates()

    # 3 — Validate required columns
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Required columns missing: {missing}")

    # 4 — Strip whitespace; treat "nan"/"None"/"" as null
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace({"nan": None, "None": None, "none": None, "": None})

    # 5 — Fill defaults for all expected fields
    df["category"] = df["category"].apply(_normalise_category) \
        if "category" in df.columns else "Other"

    df["severity"] = (
        pd.to_numeric(df.get("severity", 5), errors="coerce")
        .fillna(5).clip(1, 10).astype(int)
    ) if "severity" in df.columns else 5

    df["frequency"] = (
        pd.to_numeric(df.get("frequency", 1), errors="coerce")
        .fillna(1).clip(lower=1).astype(int)
    ) if "frequency" in df.columns else 1

    df["volunteers_needed"] = (
        pd.to_numeric(df.get("volunteers_needed", 1), errors="coerce")
        .fillna(1).clip(lower=1).astype(int)
    ) if "volunteers_needed" in df.columns else 1

    for col in ("location", "zone"):
        df[col] = df[col].fillna("") if col in df.columns else ""

    for col in ("lat", "lng"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # 6 — Drop rows with missing / trivially short descriptions
    df = df[df["description"].notna() & (df["description"].str.len() > 5)]

    # 7 — Reset index cleanly
    df = df.reset_index(drop=True)

    return df


def parse_ocr_text_to_df(raw_text: str) -> pd.DataFrame:
    """
    Convert raw unstructured OCR text into a DataFrame.

    Strategy (tried in order):
      A. JSON — if Gemini returned structured JSON, parse directly.
      B. Key:value pairs — if text contains "key: value" lines, extract them.
      C. Plain text — collapse all lines into a single description row.

    Returns a DataFrame with at least a 'description' column.
    """
    text = raw_text.strip()
    if not text:
        raise ValueError("OCR returned empty text")

    # ── Strategy A: JSON ──────────────────────────────────────────────
    df = _try_parse_json(text)
    if df is not None:
        return df

    # ── Strategy B: Multi-record key:value ────────────────────────────
    df = _try_parse_key_value(text)
    if df is not None and not df.empty:
        return df

    # ── Strategy C: Plain prose → single row ─────────────────────────
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    description = " ".join(lines)
    return pd.DataFrame([{"description": description}])


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _try_parse_json(text: str) -> pd.DataFrame | None:
    """If the text is valid JSON (array or object), parse it into a DataFrame."""
    # Strip markdown code fences that Gemini sometimes adds
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return pd.DataFrame(data)
        if isinstance(data, dict):
            return pd.DataFrame([data])
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _try_parse_key_value(text: str) -> pd.DataFrame | None:
    """
    Parse text containing key: value lines into rows.
    Handles two formats:
      1. Single record: lines are key:value pairs for one entry.
      2. Multiple records: records separated by blank lines or dashes.
    """
    # Split into record blocks (blank lines or dash separators)
    blocks = re.split(r"\n{2,}|(?:\n[-─=]{3,}\n)", text)
    rows = []
    for block in blocks:
        record = {}
        for line in block.splitlines():
            m = re.match(r"^([A-Za-z_\s]{2,30}):\s*(.+)$", line.strip())
            if m:
                key = m.group(1).strip().lower().replace(" ", "_")
                val = m.group(2).strip()
                record[key] = val
        if record and "description" in record:
            rows.append(record)

    if rows:
        return pd.DataFrame(rows)

    # Single record fallback: combine all values as one description
    all_vals = []
    for line in text.splitlines():
        m = re.match(r"^[A-Za-z_\s]{2,30}:\s*(.+)$", line.strip())
        if m:
            all_vals.append(m.group(1).strip())
    if all_vals:
        return pd.DataFrame([{"description": ". ".join(all_vals)}])

    return None


def _normalise_category(val) -> str:
    """Map any raw category string to a valid VALID_CATEGORIES value."""
    if not val or str(val).lower() in ("none", "nan", "other", ""):
        return "Other"
    cleaned = str(val).strip().title()
    # Exact match (case-insensitive)
    for cat in VALID_CATEGORIES:
        if cat.lower() == cleaned.lower():
            return cat
    # Keyword hints
    low = cleaned.lower()
    if any(k in low for k in ("medical", "health", "doctor", "hospital", "clinic", "nurse", "injury")):
        return "Medical"
    if any(k in low for k in ("food", "hunger", "meal", "water", "nutrition", "kitchen", "ration")):
        return "Food"
    if any(k in low for k in ("shelter", "house", "roof", "home", "tent", "tarp", "displaced")):
        return "Shelter"
    if any(k in low for k in ("educat", "school", "teach", "learn", "book", "class", "student")):
        return "Education"
    if any(k in low for k in ("mental", "counsel", "trauma", "stress", "anxiety", "psych", "grief")):
        return "Mental Health"
    if any(k in low for k in ("construct", "build", "repair", "infra", "road", "bridge", "carpenter")):
        return "Construction"
    return "Other"


def validate_row(row: dict) -> bool:
    """Check a single row dict has the minimum required fields."""
    desc = row.get("description", "")
    return bool(desc and str(desc).strip() and len(str(desc).strip()) > 5)
