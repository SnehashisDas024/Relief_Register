"""
services/ingestion_service.py — Full ingestion pipeline orchestrator.
Called by Celery task_process_upload. Runs inside Flask app context.
"""
import io
import os
import requests
from app.modules.pipeline_state import set_stage
from app.modules.dead_letter import send_to_dead_letter


def run_pipeline(source_id: str, file_url: str, file_ext: str, uploader_id: int):
    """
    Full pipeline:
      download → OCR/parse → clean → classify → score → save DB → Redis ZADD
    """
    from app.extensions import db
    from app.models.need import Need
    from app.modules.priority import compute_urgency_score, add_to_priority_queue
    from app.modules.cleaning import clean_dataframe, parse_ocr_text_to_df
    from app.modules.classification import classify_batch

    try:
        # ── 1. Download file bytes ────────────────────────────────────
        if not file_url:
            send_to_dead_letter(source_id, "No file URL provided", {})
            return
        if file_url.startswith("local://"):
            # Cloudinary not configured — file was saved locally
            local_path = file_url[len("local://"):]
            with open(local_path, "rb") as fp:
                file_bytes = fp.read()
        else:
            resp = requests.get(file_url, timeout=30)
            resp.raise_for_status()
            file_bytes = resp.content

        set_stage(source_id, "extracted", {"size_bytes": len(file_bytes)})

        # ── 2. OCR or parse ───────────────────────────────────────────
        import pandas as pd

        if file_ext in (".png", ".jpg", ".jpeg", ".pdf"):
            from app.modules.ocr import extract_text
            raw_text = extract_text(file_bytes, file_ext)
            if not raw_text.strip():
                send_to_dead_letter(source_id, "OCR returned empty text", {"ext": file_ext})
                return
            df = parse_ocr_text_to_df(raw_text)
            df["source_type"] = "ocr_image"
        elif file_ext == ".csv":
            df = pd.read_csv(io.BytesIO(file_bytes))
            df["source_type"] = "csv"
        elif file_ext == ".xlsx":
            df = pd.read_excel(io.BytesIO(file_bytes))
            df["source_type"] = "csv"
        else:
            send_to_dead_letter(source_id, f"Unsupported extension: {file_ext}", {})
            return

        # ── 3. Clean ──────────────────────────────────────────────────
        set_stage(source_id, "cleaned")
        from app.modules.cleaning import clean_dataframe
        df = clean_dataframe(df)

        # ── 4. Classify ───────────────────────────────────────────────
        set_stage(source_id, "classified")
        if "category" not in df.columns or (df["category"] == "Other").all():
            categories = classify_batch(df["description"].tolist())
            df["category"] = categories

        # ── 5. Score + save ───────────────────────────────────────────
        set_stage(source_id, "scored")
        saved_ids = []

        for _, row in df.iterrows():
            urgency = compute_urgency_score(
                severity=int(row.get("severity", 5)),
                frequency=int(row.get("frequency", 1)),
                volunteers_needed=int(row.get("volunteers_needed", 1)),
                volunteers_available=0,
                category=row.get("category", "Other"),
                source_type=row.get("source_type", "csv"),
                reporter_trust=1.0,
            )
            need = Need(
                submitted_by=uploader_id,
                category=row.get("category", "Other"),
                description=str(row.get("description", "")),
                severity=int(row.get("severity", 5)),
                frequency=int(row.get("frequency", 1)),
                volunteers_needed=int(row.get("volunteers_needed", 1)),
                location=str(row.get("location", "")),
                zone=str(row.get("zone", "")),
                lat=float(row["lat"]) if "lat" in row and row["lat"] else None,
                lng=float(row["lng"]) if "lng" in row and row["lng"] else None,
                urgency_score=urgency,
                source_type=row.get("source_type", "csv"),
            )
            db.session.add(need)
            db.session.flush()
            saved_ids.append((need.id, urgency))

        db.session.commit()

        # ── 6. Add all to Redis priority queue ────────────────────────
        set_stage(source_id, "matched", {"needs_saved": len(saved_ids)})
        for need_id, score in saved_ids:
            add_to_priority_queue(need_id, score)

        # ── 7. Done ───────────────────────────────────────────────────
        set_stage(source_id, "notified", {"needs_saved": len(saved_ids)})

    except Exception as e:
        import traceback
        send_to_dead_letter(source_id, str(e), {"traceback": traceback.format_exc()})
        raise
