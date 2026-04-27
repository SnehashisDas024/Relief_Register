"""
backend/app/extensions.py — Shared Flask extension instances.

All extensions are created here WITHOUT an app object so they can be
imported by any module without circular import issues.
create_app() in backend/app/__init__.py calls .init_app(app) on each.
"""
import os
import redis
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_mail import Mail
from flask_cors import CORS
from flask_migrate import Migrate

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
mail = Mail()
cors = CORS()
migrate = Migrate()


def get_redis_client() -> redis.Redis:
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    return redis.Redis.from_url(url, decode_responses=True)


redis_client: redis.Redis = get_redis_client()
