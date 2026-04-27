from datetime import datetime
from app.extensions import db


class FailedIngestion(db.Model):
    __tablename__ = "failed_ingestions"

    id = db.Column(db.Integer, primary_key=True)
    source_id = db.Column(db.String(64), nullable=False, index=True)
    reason = db.Column(db.Text, nullable=False)
    raw_data = db.Column(db.JSON, default=dict)
    reviewed = db.Column(db.Boolean, default=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "source_id": self.source_id,
            "reason": self.reason,
            "raw_data": self.raw_data,
            "reviewed": self.reviewed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
