"""
services/matching_service.py — Orchestrates match + assign flow.
"""
from app.extensions import db
from app.models.need import Need
from app.models.volunteer import Volunteer
from app.models.task import Task
from app.modules.matching import match_volunteers_to_need
from app.modules.priority import remove_from_queue


def get_top_matches(need_id: int, top_k: int = 10) -> list:
    """Load need + volunteers, run match engine, return top-K list."""
    need = Need.query.get(need_id)
    if not need:
        return []

    volunteers = (
        Volunteer.query
        .join(Volunteer.user)
        .filter(Volunteer.is_available == True)
        .all()
    )

    return match_volunteers_to_need(need, volunteers, top_k=top_k)


def assign_volunteer(need_id: int, volunteer_id: int) -> dict:
    """
    Create a Task row, mark need as assigned, create chat room,
    remove from Redis queue, trigger notification.
    """
    need = Need.query.get_or_404(need_id)
    vol = Volunteer.query.get_or_404(volunteer_id)

    # Create task
    chat_room = f"task_{need_id}"
    task = Task(
        need_id=need_id,
        volunteer_id=vol.id,
        status="assigned",
        chat_room=chat_room,
    )
    db.session.add(task)

    # Mark need assigned
    need.status = "assigned"

    # Mark volunteer unavailable
    vol.is_available = False

    db.session.commit()

    # Remove from priority queue
    remove_from_queue(need_id)

    # Trigger notification (non-blocking)
    try:
        from app.services.celery_bridge import task_send_notification
        task_send_notification.delay(
            user_id=vol.user_id,
            message=f"You have been assigned to a new task: {need.category} in {need.location}",
            notif_type="task",
            email=vol.user.email if vol.user else None,
            phone=vol.user.phone if vol.user else None,
        )
    except Exception:
        pass

    return {
        "task_id": task.id,
        "chat_room": chat_room,
        "need_id": need_id,
        "volunteer_id": volunteer_id,
        "status": "assigned",
    }
