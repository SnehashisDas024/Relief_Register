from datetime import datetime
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum("admin", "user", "volunteer", name="user_role"), nullable=False, default="user")
    phone = db.Column(db.String(20), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    volunteer_profile = db.relationship("Volunteer", back_populates="user", uselist=False, lazy="select")
    needs = db.relationship("Need", back_populates="submitter", lazy="dynamic")
    messages = db.relationship("Message", back_populates="sender", lazy="dynamic")
    notifications = db.relationship("Notification", back_populates="user", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"
