"""
routes/auth.py — /api/auth/register and /api/auth/login
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.user import User
from app.models.volunteer import Volunteer

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = data.get("role", "user")

    if not name or not email or not password:
        return jsonify({"message": "name, email and password are required"}), 400
    if role not in ("admin", "user", "volunteer"):
        return jsonify({"message": "Invalid role"}), 400
    if len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        phone=data.get("phone"),
    )
    db.session.add(user)
    db.session.flush()  # get user.id before commit

    if role == "volunteer":
        skills = data.get("skills") or []
        skills_vector = data.get("skills_vector") or [1] * len(skills)
        vol = Volunteer(
            user_id=user.id,
            skills=skills,
            skills_vector=skills_vector,
            zone=data.get("zone") or "",
            lat=data.get("lat"),
            lng=data.get("lng"),
        )
        db.session.add(vol)

    db.session.commit()

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name},
    )
    return jsonify({"token": token, "role": user.role, "name": user.name, "user_id": user.id}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid credentials"}), 401
    if not user.is_active:
        return jsonify({"message": "Account disabled. Contact admin."}), 403

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name},
    )
    return jsonify({"token": token, "role": user.role, "name": user.name, "user_id": user.id}), 200
