"""
routes/volunteers.py — /api/volunteers/*
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.volunteer import Volunteer
from app.models.task import Task
from app.models.need import Need

volunteers_bp = Blueprint("volunteers", __name__, url_prefix="/api/volunteers")


@volunteers_bp.route("/location", methods=["GET"])
@jwt_required()
def get_locations():
    """All volunteer GPS coords for the map."""
    vols = Volunteer.query.join(Volunteer.user).all()
    return jsonify({"volunteers": [v.to_dict() for v in vols]})


@volunteers_bp.route("/location", methods=["POST"])
@jwt_required()
def update_location():
    """Volunteer posts their own GPS position."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    vol = Volunteer.query.filter_by(user_id=user_id).first_or_404()
    vol.lat = data.get("lat", vol.lat)
    vol.lng = data.get("lng", vol.lng)
    db.session.commit()
    return jsonify({"status": "ok"})


@volunteers_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    """Return active + history tasks for the current volunteer."""
    user_id = int(get_jwt_identity())
    vol = Volunteer.query.filter_by(user_id=user_id).first_or_404()

    active = (
        Task.query
        .filter(Task.volunteer_id == vol.id, Task.status.in_(["assigned", "in_progress"]))
        .order_by(Task.assigned_at.desc())
        .all()
    )
    history = (
        Task.query
        .filter(Task.volunteer_id == vol.id, Task.status.in_(["completed", "declined"]))
        .order_by(Task.completed_at.desc())
        .limit(20)
        .all()
    )
    return jsonify({
        "active": [t.to_dict() for t in active],
        "history": [t.to_dict() for t in history],
    })


@volunteers_bp.route("/accept", methods=["POST"])
@jwt_required()
def accept_task():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    task_id = data.get("task_id")
    vol = Volunteer.query.filter_by(user_id=user_id).first_or_404()
    task = Task.query.filter_by(id=task_id, volunteer_id=vol.id).first_or_404()
    task.status = "in_progress"
    db.session.commit()
    return jsonify({"status": "in_progress"})


@volunteers_bp.route("/decline", methods=["POST"])
@jwt_required()
def decline_task():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    task_id = data.get("task_id")
    vol = Volunteer.query.filter_by(user_id=user_id).first_or_404()
    task = Task.query.filter_by(id=task_id, volunteer_id=vol.id).first_or_404()
    task.status = "declined"
    # Re-open the need
    need = Need.query.get(task.need_id)
    if need:
        need.status = "open"
    db.session.commit()
    return jsonify({"status": "declined"})


@volunteers_bp.route("/complete", methods=["POST"])
@jwt_required()
def complete_task():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    task_id = data.get("task_id")
    vol = Volunteer.query.filter_by(user_id=user_id).first_or_404()
    task = Task.query.filter_by(id=task_id, volunteer_id=vol.id).first_or_404()
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    if task.assigned_at:
        delta = task.completed_at - task.assigned_at
        task.resolution_time_hrs = delta.total_seconds() / 3600
    need = Need.query.get(task.need_id)
    if need:
        need.status = "completed"
    db.session.commit()
    return jsonify({"status": "completed"})


@volunteers_bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    vol = Volunteer.query.filter_by(user_id=user_id).first_or_404()
    if "is_available" in data:
        vol.is_available = bool(data["is_available"])
    if "zone" in data:
        vol.zone = data["zone"]
    if "skills" in data:
        vol.skills = data["skills"]
    db.session.commit()
    # Invalidate cached volunteer matrix
    from app.extensions import redis_client
    redis_client.delete("sra:matching:volunteer_matrix")
    return jsonify({"status": "updated"})


@volunteers_bp.route("/feedback/<int:task_id>", methods=["POST"])
@jwt_required()
def submit_feedback(task_id):
    data = request.get_json(silent=True) or {}
    rating = float(data.get("rating", 0))
    comment = data.get("comment", "")
    if not (1 <= rating <= 5):
        return jsonify({"message": "Rating must be 1-5"}), 400
    from app.services.celery_bridge import task_update_feedback
    task_update_feedback.delay(task_id, rating, comment)
    return jsonify({"status": "recorded"})
