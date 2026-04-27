from datetime import datetime
from app.extensions import db


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    need_id = db.Column(db.Integer, db.ForeignKey("needs.id"), nullable=False)
    volunteer_id = db.Column(db.Integer, db.ForeignKey("volunteers.id"), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(
        db.Enum("assigned", "in_progress", "completed", "declined", name="task_status"),
        default="assigned"
    )
    completed_at = db.Column(db.DateTime, nullable=True)
    volunteer_rating = db.Column(db.Float, nullable=True)
    rating_comment = db.Column(db.Text, nullable=True)
    resolution_time_hrs = db.Column(db.Float, nullable=True)
    chat_room = db.Column(db.String(120), nullable=True)

    need = db.relationship("Need", back_populates="tasks")
    volunteer = db.relationship("Volunteer", back_populates="tasks")

    def to_dict(self):
        return {
            "id": self.id,
            "need_id": self.need_id,
            "volunteer_id": self.volunteer_id,
            "need": self.need.to_dict() if self.need else {},
            "status": self.status,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "rating": self.volunteer_rating,
            "chat_room": self.chat_room or f"task_{self.id}",
        }
