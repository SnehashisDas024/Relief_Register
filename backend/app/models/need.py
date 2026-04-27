from datetime import datetime
from app.extensions import db


class Need(db.Model):
    __tablename__ = "needs"
    __table_args__ = (
        db.Index("idx_need_status_priority", "status", "urgency_score"),
    )

    id = db.Column(db.Integer, primary_key=True)
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    category = db.Column(db.String(80), nullable=False, default="Other")
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.Integer, default=5)          # raw 1-10
    frequency = db.Column(db.Integer, default=1)
    volunteers_needed = db.Column(db.Integer, default=1)
    location = db.Column(db.String(200), nullable=True)
    zone = db.Column(db.String(120), nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    skills_vector = db.Column(db.JSON, default=list)
    urgency_score = db.Column(db.Float, default=0.0)
    status = db.Column(
        db.Enum("open", "assigned", "completed", name="need_status"),
        default="open",
        nullable=False
    )
    source_type = db.Column(db.String(40), default="manual")  # csv, ocr_image, manual, api
    reporter_trust = db.Column(db.Float, default=1.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    submitter = db.relationship("User", back_populates="needs")
    tasks = db.relationship("Task", back_populates="need", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "submitted_by": self.submitted_by,
            "category": self.category,
            "description": self.description,
            "severity": self.severity,
            "frequency": self.frequency,
            "volunteers_needed": self.volunteers_needed,
            "location": self.location,
            "zone": self.zone,
            "lat": self.lat,
            "lng": self.lng,
            "urgency_score": round(self.urgency_score, 4),
            "status": self.status,
            "source_type": self.source_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Need id={self.id} category={self.category} score={self.urgency_score:.2f}>"
