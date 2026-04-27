"""
backend/app/__init__.py — Flask application factory.

Flask is told to find templates and static files from the frontend/ folder
at the repository root, as per the monorepo structure documented in
Structure_final.pdf:

    smart-resource-allocation/
    ├── frontend/
    │   ├── templates/   ← Flask reads HTML from here
    │   └── static/      ← Flask serves CSS/JS/img from here
    └── backend/
        └── app/
            └── __init__.py  ← this file (2 levels up → repo root)

Template resolution:
  render_template("dashboard.html")
  → frontend/templates/dashboard.html

Static resolution:
  url_for("static", filename="css/base.css")
  → frontend/static/css/base.css
"""

import os
import eventlet
eventlet.monkey_patch()

from flask import Flask
from dotenv import load_dotenv

load_dotenv()


def create_app(config_name: str = None) -> Flask:
    """
    Application factory.  config_name is optional; falls back to FLASK_ENV.
    """
    # ── Resolve paths relative to THIS file so they work on any machine ──
    # backend/app/__init__.py  → 2 levels up → repo root
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    template_dir = os.path.join(repo_root, "frontend", "templates")
    static_dir = os.path.join(repo_root, "frontend", "static")

    app = Flask(
        __name__,
        template_folder=template_dir,
        static_folder=static_dir,
        static_url_path="/static",
    )

    # ── Load configuration ─────────────────────────────────────────────
    from app.config import get_config
    app.config.from_object(get_config(config_name))

    # ── Initialise extensions (all use init_app pattern) ──────────────
    from app.extensions import db, jwt, socketio, mail, cors, migrate

    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, message_queue=app.config.get("REDIS_URL"), cors_allowed_origins="*")
    mail.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    migrate.init_app(app, db)

    # ── Import models so SQLAlchemy/Alembic can detect all tables ─────
    with app.app_context():
        from app.models.user import User                            # noqa
        from app.models.volunteer import Volunteer                  # noqa
        from app.models.need import Need                            # noqa
        from app.models.task import Task                            # noqa
        from app.models.message import Message                      # noqa
        from app.models.notification import Notification            # noqa
        from app.models.category_feedback import CategoryFeedback   # noqa
        from app.models.failed_ingestion import FailedIngestion     # noqa
        db.create_all()

    # ── Register route blueprints ──────────────────────────────────────
    from app.routes.pages import pages_bp
    from app.routes.auth import auth_bp
    from app.routes.needs import needs_bp
    from app.routes.volunteers import volunteers_bp
    from app.routes.admin import admin_bp      # also registers /api/upload, /api/match, /api/assign
    from app.routes.chat import chat_bp
    from app.routes.health import health_bp
    from app.routes.admin_register import admin_register_bp

    for bp in (pages_bp, auth_bp, admin_register_bp, needs_bp, volunteers_bp, admin_bp, chat_bp, health_bp):
        app.register_blueprint(bp)

    # ── Register SocketIO event handlers ──────────────────────────────
    _register_socket_events(app, socketio)

    return app


def _register_socket_events(app, socketio):
    """Attach all SocketIO event handlers to the shared socketio instance."""
    from flask_socketio import join_room, leave_room, emit

    @socketio.on("join")
    def on_join(data):
        room = data.get("room")
        if room:
            join_room(room)
            emit("receive_message", {
                "sender": "System",
                "content": f"Joined room {room}",
                "time": "",
                "role": "system",
            }, room=room)

    @socketio.on("send_message")
    def on_message(data):
        room = data.get("room")
        sender_id = data.get("sender_id")
        content = (data.get("content") or "").strip()
        role = data.get("role", "user")
        if not room or not content:
            return
        with app.app_context():
            from app.models.user import User
            from app.models.message import Message
            from app.extensions import db
            user = User.query.get(sender_id)
            msg = Message(room=room, sender_id=sender_id, content=content)
            db.session.add(msg)
            db.session.commit()
            emit("receive_message", {
                "sender": user.name if user else "Unknown",
                "content": content,
                "time": msg.created_at.strftime("%H:%M"),
                "role": role,
                "msg_id": msg.id,
            }, room=room)

    @socketio.on("leave")
    def on_leave(data):
        room = data.get("room")
        if room:
            leave_room(room)

    @socketio.on("location_update")
    def on_location(data):
        vol_id = data.get("volunteer_id")
        lat = data.get("lat")
        lng = data.get("lng")
        if vol_id and lat and lng:
            with app.app_context():
                from app.models.volunteer import Volunteer
                from app.extensions import db
                vol = Volunteer.query.get(vol_id)
                if vol:
                    vol.lat = lat
                    vol.lng = lng
                    db.session.commit()
            emit("tracker_update", {"volunteer_id": vol_id, "lat": lat, "lng": lng}, broadcast=True)

    @socketio.on("disconnect")
    def on_disconnect():
        pass  # log if needed


# Module-level app instance used by Gunicorn (run.py also imports this)
app = create_app()
