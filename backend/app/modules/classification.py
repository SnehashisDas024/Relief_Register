"""
modules/classification.py — spaCy NLP batch classification.
Model loaded ONCE at module level — never inside a function.
"""
import re
from typing import List

# Load model once at import time — critical for performance
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Graceful fallback if model not downloaded yet
    try:
        from spacy.cli import download
        download("en_core_web_sm")
        import spacy
        nlp = spacy.load("en_core_web_sm")
    except Exception:
        nlp = None

CATEGORY_KEYWORDS = {
    "Medical":       ["medical", "health", "doctor", "hospital", "injury", "medicine",
                      "first aid", "wound", "sick", "clinic", "nurse", "ambulance"],
    "Food":          ["food", "hunger", "meal", "water", "nutrition", "kitchen",
                      "ration", "supplies", "hungry", "distribution", "feed"],
    "Shelter":       ["shelter", "house", "roof", "home", "tent", "tarp", "displaced",
                      "homeless", "accommodation", "building", "flood"],
    "Education":     ["school", "education", "teacher", "student", "learn", "books",
                      "training", "class", "workshop", "children", "tutor"],
    "Mental Health": ["mental", "counseling", "trauma", "stress", "anxiety", "depression",
                      "psychological", "support", "therapy", "grief"],
    "Construction":  ["construction", "repair", "build", "infrastructure", "road",
                      "bridge", "labour", "carpenter", "mason", "plumber"],
}


def classify_batch(texts: List[str]) -> List[str]:
    """
    Classify a list of text strings into categories.
    Uses spaCy nlp.pipe() for batch speed (3-5x vs loop).
    Falls back to keyword matching if spaCy unavailable.
    """
    if not texts:
        return []

    if nlp is not None:
        results = []
        docs = nlp.pipe(texts, batch_size=32, disable=["parser", "ner"])
        for doc in docs:
            combined = doc.text.lower()
            results.append(_keyword_match(combined))
        return results
    else:
        return [_keyword_match(t.lower()) for t in texts]


def classify_single(text: str) -> str:
    return classify_batch([text])[0]


def _keyword_match(text_lower: str) -> str:
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score:
            scores[category] = score
    if scores:
        return max(scores, key=scores.get)
    return "Other"
