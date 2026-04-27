"""
backend/app/config/settings.py — Dev / Prod / Test configuration classes.
All secrets come from environment variables — never hardcoded.
"""
import os
from datetime import timedelta


class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 280,
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    }

    # File uploads
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024   # 16 MB
    UPLOAD_EXTENSIONS = {".csv", ".xlsx", ".pdf", ".png", ".jpg", ".jpeg"}

    # Redis
    REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

    # Celery
    CELERY_BROKER_URL = os.environ.get(
        "CELERY_BROKER_URL",
        os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0"),
    )
    CELERY_RESULT_BACKEND = os.environ.get(
        "CELERY_RESULT_URL",
        os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0"),
    )
    CELERY_TASK_SERIALIZER = "json"
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]
    CELERY_TIMEZONE = "UTC"
    CELERY_ENABLE_UTC = True

    # Cloudinary
    CLOUDINARY_URL = os.environ.get("CLOUDINARY_URL", "")

    # Gemini AI
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

    # Mail (Flask-Mail)
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_USERNAME", "noreply@sra.org")

    # Twilio SMS
    TWILIO_SID = os.environ.get("TWILIO_SID", "")
    TWILIO_TOKEN = os.environ.get("TWILIO_TOKEN", "")
    TWILIO_PHONE = os.environ.get("TWILIO_PHONE", "")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///sra_dev.db")
    DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///sra.db")


class ProductionConfig(BaseConfig):
    DEBUG = False
    _db_url = os.environ.get("DATABASE_URL", "")
    # Render supplies postgres:// — SQLAlchemy needs postgresql://
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    JWT_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=60)


_config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(config_name: str = None):
    env = config_name or os.environ.get("FLASK_ENV", "development")
    return _config_map.get(env, DevelopmentConfig)
