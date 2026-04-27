"""
services/notification_service.py — Email + SMS + SocketIO in-app push.
"""
import os
from app.extensions import db, socketio


def dispatch_notification(user_id: int, message: str, notif_type: str = "task",
                           email: str = None, phone: str = None):
    """Save to DB, send email, send SMS, emit SocketIO event."""

    # ── 1. Save to notifications table ──────────────────────────────
    try:
        from app.models.notification import Notification
        notif = Notification(user_id=user_id, message=message, notification_type=notif_type)
        db.session.add(notif)
        db.session.commit()
    except Exception as e:
        print(f"[Notification] DB save error: {e}")

    # ── 2. SocketIO in-app push ──────────────────────────────────────
    try:
        socketio.emit("notification", {"message": message, "type": notif_type},
                      room=f"user_{user_id}")
    except Exception:
        pass

    # ── 3. Email via Flask-Mail ──────────────────────────────────────
    if email:
        try:
            from flask_mail import Message as MailMessage
            from app.extensions import mail
            msg = MailMessage(
                subject="Smart Resource Allocation — Task Update",
                recipients=[email],
                body=message,
            )
            mail.send(msg)
        except Exception as e:
            print(f"[Notification] Email error: {e}")

    # ── 4. SMS via Twilio ────────────────────────────────────────────
    if phone:
        try:
            from twilio.rest import Client
            client = Client(os.environ.get("TWILIO_SID"), os.environ.get("TWILIO_TOKEN"))
            client.messages.create(
                body=f"SRA: {message}",
                from_=os.environ.get("TWILIO_PHONE"),
                to=phone,
            )
        except Exception as e:
            print(f"[Notification] SMS error: {e}")
