"""
backend/app/routes/pages.py — HTML page routes.

Two rendering strategies coexist:
  1. Jinja2 templates  — classic multi-page Flask (login, register, dashboard…)
  2. React SPA         — /app catches all, serves frontend/templates/app.html
                         (the vite-built single-file bundle)

Strategy (2) is the production default; strategy (1) stays as fallback for
environments where the React build is not available.
"""
from flask import Blueprint, render_template, redirect, url_for

pages_bp = Blueprint("pages", __name__)


# ── Public ────────────────────────────────────────────────────────────────────

@pages_bp.route("/")
def index():
    """Landing page."""
    return render_template("index.html")


@pages_bp.route("/login")
def login():
    return render_template("login.html")


@pages_bp.route("/register")
def register():
    return render_template("register.html")


# ── Admin ─────────────────────────────────────────────────────────────────────

@pages_bp.route("/dashboard")
def dashboard():
    """NGO Admin dashboard — auth enforced client-side by React."""
    return render_template("dashboard.html")


@pages_bp.route("/map")
def map_view():
    return render_template("map.html")


@pages_bp.route("/admin")
def admin_panel():
    return render_template("admin.html")


# ── Volunteer ─────────────────────────────────────────────────────────────────

@pages_bp.route("/volunteer")
def volunteer_dashboard():
    return render_template("volunteer_dashboard.html")


# ── Chat ──────────────────────────────────────────────────────────────────────

@pages_bp.route("/chat/<room_id>")
def chat(room_id):
    return render_template("chat.html", room_id=room_id)


# ── React SPA catch-all ───────────────────────────────────────────────────────
# Serves the compiled React bundle for any route the Jinja templates don't cover.
# vite-plugin-singlefile produces frontend/templates/app.html as a single file.

@pages_bp.route("/app", defaults={"path": ""})
@pages_bp.route("/app/<path:path>")
def spa(path):
    """Serve the compiled React SPA."""
    return render_template("app.html")
