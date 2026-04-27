"""
routes/chat.py — REST history + notifications (SocketIO events are in app.py)
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.message import Message
from app.models.notification import Notification
from app.extensions import db

chat_bp = Blueprint("chat", __name__, url_prefix="/api")


@chat_bp.route("/chat/<room_id>/history", methods=["GET"])
@jwt_required()
def get_history(room_id):
    msgs = (
        Message.query
        .filter_by(room=room_id)
        .order_by(Message.created_at.asc())
        .limit(200)
        .all()
    )
    return jsonify({"messages": [m.to_dict() for m in msgs]})


@chat_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    notifs = (
        Notification.query
        .filter_by(user_id=user_id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )
    unread = sum(1 for n in notifs if not n.is_read)
    return jsonify({"notifications": [n.to_dict() for n in notifs], "unread_count": unread})


@chat_bp.route("/notifications/read", methods=["PATCH"])
@jwt_required()
def mark_read():
    user_id = int(get_jwt_identity())
    Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"status": "ok"})


@chat_bp.route("/feedback/<int:task_id>", methods=["POST"])
@jwt_required()
def feedback_route(task_id):
    """Alias so volunteer.js can POST /api/feedback/<id>"""
    from flask import request
    data = request.get_json(silent=True) or {}
    rating = float(data.get("rating", 0))
    comment = data.get("comment", "")
    if not (1 <= rating <= 5):
        return jsonify({"message": "Rating 1-5 required"}), 400
    from app.services.celery_bridge import task_update_feedback
    task_update_feedback.delay(task_id, rating, comment)
    return jsonify({"status": "recorded"})
