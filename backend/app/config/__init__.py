"""
backend/app/config/__init__.py
Re-exports get_config so that `from app.config import get_config` works.
"""
from app.config.settings import get_config  # noqa
