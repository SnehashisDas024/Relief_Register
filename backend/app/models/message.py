from datetime import datetime
from app.extensions import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    room = db.Column(db.String(120), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

    sender = db.relationship("User", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "room": self.room,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else "Unknown",
            "role": self.sender.role if self.sender else "user",
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_read": self.is_read,
        }
