"""
routes/health.py — /health endpoint required by Render for uptime checks.
"""
from flask import Blueprint, jsonify
from app.extensions import db, redis_client

health_bp = Blueprint("health", __name__)


@health_bp.route("/health")
def health():
    status = {"db": "ok", "redis": "ok"}
    http_code = 200

    try:
        db.session.execute(db.text("SELECT 1"))
    except Exception as e:
        status["db"] = f"error: {e}"
        http_code = 503

    try:
        redis_client.ping()
    except Exception as e:
        status["redis"] = f"error: {e}"
        http_code = 503

    status["status"] = "ok" if http_code == 200 else "degraded"
    return jsonify(status), http_code
