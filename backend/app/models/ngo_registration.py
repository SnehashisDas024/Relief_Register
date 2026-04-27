from datetime import datetime
from app.extensions import db


class NgoRegistration(db.Model):
    __tablename__ = "ngo_registrations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    ngo_name = db.Column(db.String(200), nullable=False)
    ngo_head_id = db.Column(db.String(100), nullable=False)   # e.g. gov-issued NGO registration number
    proof_url = db.Column(db.String(1024), nullable=False)    # Cloudinary URL or local path
    proof_filename = db.Column(db.String(256), nullable=True)
    status = db.Column(
        db.Enum("pending", "approved", "rejected", name="ngo_status"),
        nullable=False,
        default="pending",
        index=True,
    )
    rejection_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref=db.backref("ngo_registration", uselist=False))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else "",
            "user_email": self.user.email if self.user else "",
            "ngo_name": self.ngo_name,
            "ngo_head_id": self.ngo_head_id,
            "proof_url": self.proof_url,
            "proof_filename": self.proof_filename,
            "status": self.status,
            "rejection_reason": self.rejection_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
        }

    def __repr__(self):
        return f"<NgoRegistration ngo={self.ngo_name} status={self.status}>"
