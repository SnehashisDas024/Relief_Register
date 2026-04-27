"""
backend/tests/conftest.py — Shared pytest fixtures.
"""
import os
import sys
import pytest

# Ensure backend/ is on sys.path so `from app.X` resolves
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("SECRET_KEY",     "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("REDIS_URL",      "redis://localhost:6379/15")  # DB 15 = test DB


@pytest.fixture(scope="session")
def app():
    from app import create_app
    application = create_app("testing")
    yield application


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="function")
def db_session(app):
    from app.extensions import db
    with app.app_context():
        db.create_all()
        yield db.session
        db.session.rollback()
        db.drop_all()


@pytest.fixture
def auth_headers(client):
    """Return Authorization headers for a given role."""
    def _make(role="admin", email=None, password="password123"):
        _email = email or f"{role}@test.sra.org"
        # Register
        client.post("/api/auth/register", json={
            "name": f"Test {role.title()}",
            "email": _email,
            "password": password,
            "role": role,
        })
        # Login
        res = client.post("/api/auth/login", json={"email": _email, "password": password})
        token = res.get_json().get("token", "")
        return {"Authorization": f"Bearer {token}"}
    return _make
