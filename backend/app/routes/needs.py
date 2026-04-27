"""
routes/needs.py — /api/needs  GET / POST / <id>
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.extensions import db, redis_client
from app.models.need import Need
import json

needs_bp = Blueprint("needs", __name__, url_prefix="/api/needs")

CATEGORY_LIST = ["Medical","Food","Shelter","Education","Mental Health","Construction","Other"]


@needs_bp.route("", methods=["GET"])
@jwt_required()
def get_needs():
    status = request.args.get("status")          # open / assigned / completed
    category = request.args.get("category")
    zone = request.args.get("zone")
    limit = min(int(request.args.get("limit", 50)), 200)

    # Try Redis priority queue first (top open needs)
    try:
        ids = redis_client.zrange("sra:priority:active", 0, limit - 1, withscores=True, desc=True)
        if ids:
            need_ids = [int(nid) for nid, _ in ids]
            needs = Need.query.filter(Need.id.in_(need_ids)).all()
            needs_sorted = sorted(needs, key=lambda n: need_ids.index(n.id))
            return jsonify({"needs": [n.to_dict() for n in needs_sorted]})
    except Exception:
        pass

    # Fallback: DB query
    q = Need.query.filter_by(status="open") if not status else Need.query.filter_by(status=status)
    if category:
        q = q.filter_by(category=category)
    if zone:
        q = q.filter_by(zone=zone)
    q = q.order_by(Need.urgency_score.desc()).limit(limit)
    needs = q.all()
    return jsonify({"needs": [n.to_dict() for n in needs]})


@needs_bp.route("", methods=["POST"])
@jwt_required()
def submit_need():
    """Manual need submission by user or volunteer."""
    claims = get_jwt()
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    if not data.get("description"):
        return jsonify({"message": "description is required"}), 400

    from app.modules.priority import compute_urgency_score, add_to_priority_queue

    severity = int(data.get("severity", 5))
    category = data.get("category", "Other")
    if category not in CATEGORY_LIST:
        category = "Other"

    urgency = compute_urgency_score(
        severity=severity,
        frequency=int(data.get("frequency", 1)),
        volunteers_needed=int(data.get("volunteers_needed", 1)),
        volunteers_available=0,
        category=category,
        source_type="manual",
        reporter_trust=1.0,
    )

    need = Need(
        submitted_by=user_id,
        category=category,
        description=data["description"],
        severity=severity,
        frequency=int(data.get("frequency", 1)),
        volunteers_needed=int(data.get("volunteers_needed", 1)),
        location=data.get("location", ""),
        zone=data.get("zone", ""),
        lat=data.get("lat"),
        lng=data.get("lng"),
        urgency_score=urgency,
        source_type="manual",
    )
    db.session.add(need)
    db.session.commit()

    add_to_priority_queue(need.id, urgency)

    return jsonify({"need_id": need.id, "urgency_score": urgency}), 201


@needs_bp.route("/<int:need_id>", methods=["GET"])
@jwt_required()
def get_need(need_id):
    need = Need.query.get_or_404(need_id)
    return jsonify(need.to_dict())
