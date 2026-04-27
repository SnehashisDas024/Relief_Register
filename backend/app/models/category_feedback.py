from datetime import datetime
from app.extensions import db


class CategoryFeedback(db.Model):
    __tablename__ = "category_feedback"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(80), unique=True, nullable=False)
    avg_rating = db.Column(db.Float, default=0.0)
    avg_resolution_time = db.Column(db.Float, default=0.0)
    # Priority score weights (EMA-adjusted over time)
    weight_severity = db.Column(db.Float, default=0.40)
    weight_frequency = db.Column(db.Float, default=0.30)
    weight_gap = db.Column(db.Float, default=0.30)
    sample_count = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "category": self.category,
            "avg_rating": self.avg_rating,
            "avg_resolution_time": self.avg_resolution_time,
            "weight_severity": self.weight_severity,
            "weight_frequency": self.weight_frequency,
            "weight_gap": self.weight_gap,
            "sample_count": self.sample_count,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
