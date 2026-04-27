from datetime import datetime
from app.extensions import db


class Volunteer(db.Model):
    __tablename__ = "volunteers"
    __table_args__ = (
        db.Index("idx_volunteer_geo_available", "zone", "is_available"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    skills = db.Column(db.JSON, default=list)          # list of skill strings
    skills_vector = db.Column(db.JSON, default=list)   # pre-computed float array
    zone = db.Column(db.String(120), nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    is_available = db.Column(db.Boolean, default=True)
    rating = db.Column(db.Float, default=0.0)
    rating_count = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship("User", back_populates="volunteer_profile")
    tasks = db.relationship("Task", back_populates="volunteer", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.user.name if self.user else "",
            "email": self.user.email if self.user else "",
            "skills": self.skills or [],
            "skills_vector": self.skills_vector or [],
            "zone": self.zone,
            "lat": self.lat,
            "lng": self.lng,
            "is_available": self.is_available,
            "rating": round(self.rating, 2),
            "is_active": self.user.is_active if self.user else True,
            "role": "volunteer",
            "created_at": self.user.created_at.isoformat() if self.user and self.user.created_at else None,
        }

    def __repr__(self):
        return f"<Volunteer user_id={self.user_id} zone={self.zone}>"
