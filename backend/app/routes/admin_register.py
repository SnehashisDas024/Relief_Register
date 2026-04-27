"""
routes/admin_register.py — /api/auth/admin-register
NGO admin registration with ID verification and proof-of-registration upload.
New admins are created in a 'pending' state; a superadmin must approve them.
"""
import os
import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models.user import User
from app.models.ngo_registration import NgoRegistration

admin_register_bp = Blueprint("admin_register", __name__, url_prefix="/api/auth")

ALLOWED_PROOF_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_PROOF_SIZE = 10 * 1024 * 1024  # 10 MB


@admin_register_bp.route("/admin-register", methods=["POST"])
def admin_register():
    """
    Submit an NGO admin registration request.
    Expects multipart/form-data with:
      - name, email, password, phone (text fields)
      - ngo_name, ngo_head_id (text fields)
      - proof_file (file — PDF or image of the NGO registration document)
    The account is created with is_active=False until approved by a superadmin.
    """
    # ── Parse form fields ────────────────────────────────────────────────────
    name       = (request.form.get("name") or "").strip()
    email      = (request.form.get("email") or "").strip().lower()
    password   = request.form.get("password") or ""
    phone      = (request.form.get("phone") or "").strip()
    ngo_name   = (request.form.get("ngo_name") or "").strip()
    ngo_head_id = (request.form.get("ngo_head_id") or "").strip()

    # ── Validation ───────────────────────────────────────────────────────────
    missing = [f for f, v in [("name", name), ("email", email), ("password", password),
                               ("ngo_name", ngo_name), ("ngo_head_id", ngo_head_id)] if not v]
    if missing:
        return jsonify({"message": f"Missing required fields: {', '.join(missing)}"}), 400

    if len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 409

    # ── Proof file ───────────────────────────────────────────────────────────
    if "proof_file" not in request.files or not request.files["proof_file"].filename:
        return jsonify({"message": "Proof of NGO registration (PDF or image) is required"}), 400

    proof_file = request.files["proof_file"]
    ext = os.path.splitext(proof_file.filename)[1].lower()
    if ext not in ALLOWED_PROOF_EXTENSIONS:
        return jsonify({"message": f"Proof file must be PDF, JPG, or PNG (got {ext})"}), 400

    file_bytes = proof_file.read()
    if len(file_bytes) > MAX_PROOF_SIZE:
        return jsonify({"message": "Proof file must be under 10 MB"}), 400

    # ── Store proof file (Cloudinary → fallback to local /tmp) ───────────────
    proof_url = ""
    proof_storage_key = "ngo_proof_" + uuid.uuid4().hex[:12]
    try:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            file_bytes,
            public_id=proof_storage_key,
            resource_type="raw" if ext == ".pdf" else "image",
        )
        proof_url = result.get("secure_url", "")
    except Exception:
        # Fallback: store in local uploads directory
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, proof_storage_key + ext)
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        proof_url = f"/local_uploads/{proof_storage_key}{ext}"

    # ── Create user (inactive until approved) ────────────────────────────────
    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="admin",
        phone=phone or None,
        is_active=False,   # <— requires superadmin approval
    )
    db.session.add(user)
    db.session.flush()

    # ── Create NGO registration record ───────────────────────────────────────
    ngo_reg = NgoRegistration(
        user_id=user.id,
        ngo_name=ngo_name,
        ngo_head_id=ngo_head_id,
        proof_url=proof_url,
        proof_filename=proof_file.filename,
        status="pending",
    )
    db.session.add(ngo_reg)
    db.session.commit()

    return jsonify({
        "message": "Registration submitted. Your account will be reviewed and activated by a superadmin.",
        "user_id": user.id,
        "status": "pending",
    }), 201


# ── Superadmin: list pending NGO registrations ───────────────────────────────

@admin_register_bp.route("/admin-registrations", methods=["GET"])
@jwt_required()
def list_ngo_registrations():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"message": "Admin access required"}), 403

    status_filter = request.args.get("status", "pending")
    query = NgoRegistration.query
    if status_filter != "all":
        query = query.filter_by(status=status_filter)
    regs = query.order_by(NgoRegistration.created_at.desc()).all()
    return jsonify({"registrations": [r.to_dict() for r in regs]})


# ── Superadmin: approve or reject an NGO registration ────────────────────────

@admin_register_bp.route("/admin-registrations/<int:reg_id>", methods=["PATCH"])
@jwt_required()
def review_ngo_registration(reg_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"message": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}
    action = data.get("action")  # "approve" | "reject"
    if action not in ("approve", "reject"):
        return jsonify({"message": "action must be 'approve' or 'reject'"}), 400

    reg = NgoRegistration.query.get_or_404(reg_id)
    user = User.query.get_or_404(reg.user_id)

    if action == "approve":
        reg.status = "approved"
        user.is_active = True
    else:
        reg.status = "rejected"
        user.is_active = False
        reg.rejection_reason = data.get("reason", "")

    db.session.commit()
    return jsonify({"status": reg.status, "user_id": user.id})
