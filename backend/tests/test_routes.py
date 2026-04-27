"""tests/test_routes.py — Flask route smoke tests."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("FLASK_ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")

import pytest

@pytest.fixture
def client():
    from app import create_app
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.test_client() as c:
        with app.app_context():
            from app.extensions import db
            db.create_all()
        yield c


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code in (200, 503)
    data = res.get_json()
    assert "status" in data


def test_landing_page(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"Smart Resource" in res.data or b"SRA" in res.data


def test_login_page(client):
    res = client.get("/login")
    assert res.status_code == 200


def test_register_page(client):
    res = client.get("/register")
    assert res.status_code == 200


def test_register_api(client):
    res = client.post("/api/auth/register", json={
        "name": "Test User", "email": "test@example.com",
        "password": "Test1234!", "role": "user"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert "token" in data
    assert data["role"] == "user"


def test_login_api(client):
    # Register first
    client.post("/api/auth/register", json={
        "name": "Login Test", "email": "login@example.com",
        "password": "Test1234!", "role": "user"
    })
    res = client.post("/api/auth/login", json={
        "email": "login@example.com", "password": "Test1234!"
    })
    assert res.status_code == 200
    assert "token" in res.get_json()


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "name": "Bad Login", "email": "bad@example.com",
        "password": "Test1234!", "role": "user"
    })
    res = client.post("/api/auth/login", json={
        "email": "bad@example.com", "password": "WrongPass!"
    })
    assert res.status_code == 401


def test_needs_requires_auth(client):
    res = client.get("/api/needs")
    assert res.status_code == 401


def test_dashboard_page_returns_200(client):
    res = client.get("/dashboard")
    assert res.status_code == 200


def test_map_page_returns_200(client):
    res = client.get("/map")
    assert res.status_code == 200


def test_volunteer_page_returns_200(client):
    res = client.get("/volunteer")
    assert res.status_code == 200


def test_admin_page_returns_200(client):
    res = client.get("/admin")
    assert res.status_code == 200


def test_chat_page_returns_200(client):
    res = client.get("/chat/test_room")
    assert res.status_code == 200
