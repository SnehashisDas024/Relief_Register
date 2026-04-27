"""
routes/admin.py — /api/admin/* and /api/upload, /api/match, /api/assign
"""
import os
import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.need import Need
from app.models.task import Task
from app.models.failed_ingestion import FailedIngestion

admin_bp = Blueprint("admin", __name__)

UPLOAD_EXTENSIONS = {".csv", ".xlsx", ".pdf", ".png", ".jpg", ".jpeg"}


def _require_admin():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"message": "Admin access required"}), 403
    return None


# ── Stats ────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/stats", methods=["GET"])
@jwt_required()
def get_stats():
    err = _require_admin()
    if err:
        return err

    from datetime import datetime, date
    today_start = datetime.combine(date.today(), datetime.min.time())

    open_needs = Need.query.filter_by(status="open").count()
    completed_today = Task.query.filter(
        Task.status == "completed",
        Task.completed_at >= today_start
    ).count()
    active_vols = Volunteer.query.filter_by(is_available=True).count()

    # needs by category
    from sqlalchemy import func
    cat_rows = db.session.query(Need.category, func.count(Need.id)).group_by(Need.category).all()
    needs_by_category = {row[0]: row[1] for row in cat_rows}

    # status distribution
    status_rows = db.session.query(Need.status, func.count(Need.id)).group_by(Need.status).all()
    status_dist = {row[0]: row[1] for row in status_rows}

    # match success rate
    total_tasks = Task.query.count() or 1
    completed_tasks = Task.query.filter_by(status="completed").count()
    match_rate = completed_tasks / total_tasks

    return jsonify({
        "open_needs": open_needs,
        "completed_today": completed_today,
        "active_volunteers": active_vols,
        "match_success_rate": round(match_rate, 4),
        "needs_by_category": needs_by_category,
        "status_distribution": status_dist,
    })


# ── User management ──────────────────────────────────────────────────

@admin_bp.route("/api/admin/users", methods=["GET"])
@jwt_required()
def get_users():
    err = _require_admin()
    if err:
        return err
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    users = User.query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for u in users.items:
        d = u.to_dict()
        result.append(d)

    return jsonify({"users": result, "total": users.total, "page": page})


@admin_bp.route("/api/admin/users/<int:user_id>", methods=["PATCH"])
@jwt_required()
def update_user(user_id):
    err = _require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    user = User.query.get_or_404(user_id)
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "role" in data and data["role"] in ("admin", "user", "volunteer"):
        user.role = data["role"]
    db.session.commit()
    return jsonify({"status": "updated"})


# ── Dead letters ─────────────────────────────────────────────────────

@admin_bp.route("/api/admin/dead-letters", methods=["GET"])
@jwt_required()
def get_dead_letters():
    err = _require_admin()
    if err:
        return err
    items = FailedIngestion.query.order_by(FailedIngestion.created_at.desc()).limit(100).all()
    unreviewed = sum(1 for i in items if not i.reviewed)
    return jsonify({"items": [i.to_dict() for i in items], "total_unreviewed": unreviewed})


@admin_bp.route("/api/admin/dead-letters/<int:dl_id>/review", methods=["PATCH"])
@jwt_required()
def mark_reviewed(dl_id):
    err = _require_admin()
    if err:
        return err
    item = FailedIngestion.query.get_or_404(dl_id)
    item.reviewed = True
    db.session.commit()
    return jsonify({"status": "reviewed"})


# ── Pipeline tracker ─────────────────────────────────────────────────

@admin_bp.route("/api/admin/pipeline/<source_id>", methods=["GET"])
@jwt_required()
def get_pipeline(source_id):
    err = _require_admin()
    if err:
        return err
    from app.modules.pipeline_state import get_stage
    result = get_stage(source_id)
    if not result:
        return jsonify({"message": "Source ID not found"}), 404
    return jsonify(result)


# ── File upload ──────────────────────────────────────────────────────

@admin_bp.route("/api/upload", methods=["POST"])
@jwt_required()
def upload_file():
    claims = get_jwt()
    if claims.get("role") not in ("admin", "volunteer"):
        return jsonify({"message": "Not authorised to upload"}), 403

    if "file" not in request.files:
        return jsonify({"message": "No file in request"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"message": "Empty filename"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in UPLOAD_EXTENSIONS:
        return jsonify({"message": f"File type {ext} not allowed"}), 400

    source_id = "src_" + uuid.uuid4().hex[:12]
    file_bytes = file.read()
    uploader_id = int(get_jwt().get("sub", 0))

    # Upload to Cloudinary; fall back to local temp file so Celery can still read it
    file_url = ""
    local_path = ""
    try:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            file_bytes,
            public_id=source_id,
            resource_type="raw" if ext in {".csv", ".xlsx"} else "auto",
        )
        file_url = result.get("secure_url", "")
    except Exception:
        # Save locally so the ingestion pipeline can still access the bytes
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, source_id + ext)
        with open(local_path, "wb") as fp:
            fp.write(file_bytes)
        # Use a local:// URL convention that ingestion_service can detect
        file_url = f"local://{local_path}"

    # Queue Celery pipeline task
    from app.services.celery_bridge import task_process_upload
    task_process_upload.delay(source_id, file_url, ext, uploader_id)

    # Mark stage in Redis
    from app.modules.pipeline_state import set_stage
    set_stage(source_id, "extracted", {"filename": file.filename, "size": len(file_bytes)})

    return jsonify({"source_id": source_id, "file_url": file_url, "status": "processing"}), 202


# ── Match & Assign ───────────────────────────────────────────────────

@admin_bp.route("/api/match/<int:need_id>", methods=["GET"])
@jwt_required()
def match_need(need_id):
    from app.services.matching_service import get_top_matches
    matches = get_top_matches(need_id)
    return jsonify({"matches": matches})


@admin_bp.route("/api/assign", methods=["POST"])
@jwt_required()
def assign():
    err = _require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    need_id = data.get("need_id")
    vol_id = data.get("volunteer_id")
    if not need_id or not vol_id:
        return jsonify({"message": "need_id and volunteer_id required"}), 400

    from app.services.matching_service import assign_volunteer
    result = assign_volunteer(need_id, vol_id)
    return jsonify(result), 201
