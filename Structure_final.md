# Smart Resource Allocation — Final Architecture Reference

```markdown
# Smart Resource Allocation
## Final Architecture Reference Document
### Data-Driven Volunteer Coordination for Social Impact
### H2S × Google for Developers

---
---

# TABLE OF CONTENTS

1. Project Overview
2. Roles & Permissions
3. Tech Stack
4. Monorepo Structure (Render-Compatible)
5. Root-Level Files
6. Frontend — Every File & Its Job
7. Backend — Every File & Its Job
   7.1 Entry Points
   7.2 App Factory & Extensions
   7.3 Configuration
   7.4 Routes Layer
   7.5 Services Layer
   7.6 Modules Layer (Pure Algorithms)
   7.7 Models Layer (Database)
   7.8 Celery Tasks & Pipeline
   7.9 Tests
   7.10 Migrations
8. Database Schema — All 8 Tables
9. API Endpoints — Full Reference
10. SocketIO Events — Full Reference
11. Redis Key Convention
12. Data Flow — End to End
13. Priority Engine — How It Works
14. Matching Engine — How It Works
15. Celery Pipeline — How It Works
16. Deployment — Render Checklist
17. Environment Variables Reference
18. Key Design Decisions & Why

---
---

# 1. PROJECT OVERVIEW

Local NGOs and community members collect critical data through
paper surveys and field reports. This platform:

  - Ingests data from CSV, Excel, Image, PDF, and API sources
  - Processes it through:
      OCR → Cleaning → NLP Classification →
      Priority Scoring → Geo Filtering → Volunteer Matching
  - Assigns the best available volunteer to the most urgent
    community need
  - Tracks task completion with real-time chat and live GPS
  - Learns from feedback outcomes to improve future matching

Deployment Target : Render (free tier compatible)
Architecture Type : Monorepo (frontend/ + backend/ in one repo)
Backend           : Flask + Gunicorn (eventlet) + Celery + Redis
Frontend          : Jinja2 + Bootstrap 5 + Chart.js + Leaflet.js
Database          : PostgreSQL (Render) / SQLite (local dev)
Cache & Queue     : Redis (Render)
File Storage      : Cloudinary (Render-safe, no local disk writes)
OCR               : Google Cloud Vision API (Render-safe)

---
---

# 2. ROLES & PERMISSIONS

┌─────────────────┬──────────────────┬─────────────────────────────────────┐
│ Role            │ Who              │ What They Can Do                     │
├─────────────────┼──────────────────┼─────────────────────────────────────┤
│ admin           │ NGO Staff        │ Upload data, view full dashboard,    │
│                 │                  │ assign tasks, manage all users,      │
│                 │                  │ access admin panel, chat with        │
│                 │                  │ anyone, view analytics, review       │
│                 │                  │ failed ingestions                    │
├─────────────────┼──────────────────┼─────────────────────────────────────┤
│ user            │ Community        │ Submit needs, track own submitted    │
│                 │ Members          │ needs, chat with assigned volunteer, │
│                 │                  │ rate task outcome                    │
├─────────────────┼──────────────────┼─────────────────────────────────────┤
│ volunteer       │ On-Ground        │ Upload field data (CSV / image),     │
│                 │ Volunteers /     │ accept / complete tasks, update      │
│                 │ Field Workers    │ live GPS, chat with admin and user,  │
│                 │                  │ view own task history                │
└─────────────────┴──────────────────┴─────────────────────────────────────┘

---
---

# 3. TECH STACK

┌──────────────────┬──────────────────────────────┬────────────────────────────────────────┐
│ Layer            │ Technology                   │ Purpose                                │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Backend          │ Flask + Gunicorn              │ WSGI web server                        │
│                  │ (--worker-class eventlet -w 1)│ eventlet required for SocketIO         │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ ORM              │ SQLAlchemy + Flask-SQLAlchemy │ Database abstraction layer             │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Database         │ PostgreSQL (Render)           │ Production persistence                 │
│                  │ SQLite (local dev)            │ Zero-config local development          │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Migrations       │ Flask-Migrate (Alembic)       │ Schema version control                 │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ File Storage     │ Cloudinary                   │ CSV / image / PDF backup               │
│                  │                              │ Render has no persistent disk          │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ OCR              │ Google Cloud Vision API      │ Extract text from images and PDFs      │
│                  │                              │ 1000 req/month free, Render-compatible │
│                  │                              │ (NOT Tesseract — no binary on Render)  │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Async Tasks      │ Celery + Redis               │ Background OCR, notification dispatch, │
│                  │                              │ pipeline chains, beat schedule         │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Priority Queue   │ Redis Sorted Set (ZADD)      │ Shared across all Gunicorn workers,    │
│                  │                              │ persistent across restarts             │
│                  │                              │ (NOT in-memory heapq)                  │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Cache            │ Redis                        │ Volunteer skill matrix, query cache,   │
│                  │                              │ pipeline state, category weights       │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Auth             │ Flask-JWT-Extended           │ Role-based access: admin/user/volunteer│
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Real-time        │ Flask-SocketIO + eventlet    │ Chat rooms + live GPS tracking         │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ NLP              │ spaCy (en_core_web_sm)       │ Category tagging, batch classification │
│                  │                              │ using nlp.pipe() — 3-5x faster         │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Geo Math         │ Haversine (pure Python)      │ Distance calculation, dynamic radius   │
│                  │                              │ No PostGIS needed — Render-compatible  │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Map              │ Leaflet.js + OpenStreetMap   │ Free, zero API key, volunteer markers  │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Charts           │ Chart.js                     │ Dashboard KPIs, trends, heatmaps       │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Notifications    │ Flask-Mail + Twilio          │ Email + SMS dispatch                   │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Frontend         │ Jinja2 + Bootstrap 5         │ Server-rendered HTML pages             │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Testing          │ Pytest + pytest-flask        │ Unit + integration tests               │
├──────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Deployment       │ Render                       │ Web service + Worker + Beat + Postgres │
│                  │                              │ + Redis (all free tier)                │
└──────────────────┴──────────────────────────────┴────────────────────────────────────────┘

---
---

# 4. MONOREPO STRUCTURE (RENDER-COMPATIBLE)

smart-resource-allocation/          ← Git root / Render root
│
├── frontend/                       ← ALL frontend files live here
│   ├── templates/                  ← Jinja2 HTML (Flask reads from here)
│   └── static/                     ← CSS, JS, images (Flask serves from here)
│
├── backend/                        ← ALL Python / Flask code lives here
│   ├── app/                        ← Flask application package
│   ├── tests/                      ← Pytest test suite
│   ├── migrations/                 ← Alembic migration files
│   ├── logs/                       ← Runtime log files (git-ignored)
│   ├── run.py                      ← Local dev entry point
│   ├── celery_worker.py            ← Celery app definition
│   ├── requirements.txt            ← All pip dependencies
│   └── Procfile                    ← Render process definitions
│
├── .gitignore
├── .env.example                    ← Template for all environment variables
├── README.md
├── architecture.md                 ← THIS FILE
├── docker-compose.yml              ← Local dev: Postgres + Redis + Web + Worker
└── render.yaml                     ← Render deployment configuration

---

HOW FLASK FINDS FRONTEND FILES:

  In backend/app/__init__.py, the Flask app is created as:

    app = Flask(
        __name__,
        template_folder="../../frontend/templates",
        static_folder="../../frontend/static",
        static_url_path="/static"
    )

  This means:
    - render_template("dashboard.html")
      → reads from frontend/templates/dashboard.html
    - url_for("static", filename="css/base.css")
      → serves from frontend/static/css/base.css
    - No symlinks needed. No build step needed.
    - Works on Render because paths are relative to the Python file.

---
---

# 5. ROOT-LEVEL FILES

smart-resource-allocation/
├── .gitignore
│     PURPOSE : Tells Git what NOT to track.
│     CONTENTS: Python caches, virtual environments, .env files,
│               node_modules, logs, local SQLite databases,
│               Celery beat schedule files, test coverage files,
│               OS files (.DS_Store), spaCy model downloads.
│
├── .env.example
│     PURPOSE : Template showing all required environment variables
│               with placeholder values. Committed to Git so
│               teammates know what variables to set.
│               The actual .env file is git-ignored.
│
├── README.md
│     PURPOSE : Project introduction, local setup guide, how to run
│               tests, how to deploy to Render.
│
├── architecture.md
│     PURPOSE : THIS FILE. Complete reference for every module,
│               every file, and every design decision. Used during
│               development and after for onboarding.
│
├── docker-compose.yml
│     PURPOSE : Local development environment. Starts:
│               - PostgreSQL database on port 5432
│               - Redis on port 6379
│               - Flask web server on port 5000
│               - Celery worker
│               - Celery beat scheduler
│               Developers only need Docker installed — no local
│               Postgres or Redis setup required.
│
└── render.yaml
      PURPOSE : Render platform deployment configuration.
                Defines all services (web, worker, beat),
                links to Render PostgreSQL and Redis add-ons,
                sets build commands and start commands.

---
---

# 6. FRONTEND — EVERY FILE & ITS JOB

frontend/
├── templates/
│   ├── base.html
│   │     WHAT IT IS  : Master layout template. All other pages
│   │                   extend this using Jinja2 {% extends %}.
│   │     CONTAINS    : <head> with all CDN links (Bootstrap 5,
│   │                   Chart.js, Leaflet.js, Socket.IO client),
│   │                   navbar with role-aware navigation links,
│   │                   notification toast container,
│   │                   footer, and {% block content %} for
│   │                   page-specific content injection.
│   │     USED BY     : All other HTML templates via extends.
│   │
│   ├── index.html
│   │     WHAT IT IS  : Public landing page. No login required.
│   │     CONTAINS    : Hero section explaining the platform,
│   │                   feature highlights, call-to-action buttons
│   │                   to register or login, platform statistics.
│   │     ACCESS      : Public (no JWT required).
│   │
│   ├── login.html
│   │     WHAT IT IS  : Login page.
│   │     CONTAINS    : Email + password form. On submit, calls
│   │                   POST /api/auth/login via auth.js,
│   │                   stores returned JWT in localStorage,
│   │                   redirects to role-appropriate dashboard.
│   │     ACCESS      : Public.
│   │
│   ├── register.html
│   │     WHAT IT IS  : Registration page with two tabs.
│   │     CONTAINS    : Tab 1 — Community User form (name, email,
│   │                   password, phone).
│   │                   Tab 2 — Volunteer form (same + skills
│   │                   multi-select, zone, location).
│   │                   On submit, calls POST /api/auth/register
│   │                   via auth.js.
│   │     ACCESS      : Public.
│   │
│   ├── dashboard.html
│   │     WHAT IT IS  : NGO Admin main dashboard.
│   │     CONTAINS    : KPI cards (total needs, assigned, completed,
│   │                   avg response time), Chart.js bar chart for
│   │                   needs by category, Chart.js line chart for
│   │                   weekly trend, priority needs table (top 10
│   │                   from Redis queue), file upload widget that
│   │                   calls POST /api/upload, recent activity feed.
│   │     ACCESS      : Admin only (JWT + role check).
│   │
│   ├── map.html
│   │     WHAT IT IS  : Live geo map for admin.
│   │     CONTAINS    : Full-screen Leaflet.js map initialized on
│   │                   OpenStreetMap tiles, need markers colored by
│   │                   urgency score, volunteer markers with live
│   │                   GPS updates via SocketIO tracker_update,
│   │                   click-on-marker to see detail + assign button.
│   │     ACCESS      : Admin only.
│   │
│   ├── volunteer_dashboard.html
│   │     WHAT IT IS  : Volunteer / field worker task view.
│   │     CONTAINS    : Active task card (need description, location,
│   │                   deadline), Accept / Decline / Mark Complete
│   │                   buttons, GPS update toggle (sends location
│   │                   via SocketIO), task history table, field
│   │                   data upload form (image / CSV).
│   │     ACCESS      : Volunteer only.
│   │
│   ├── chat.html
│   │     WHAT IT IS  : Real-time chat room. Same template used
│   │                   for all 3 room types.
│   │     CONTAINS    : Message history loaded from
│   │                   GET /api/chat/<room_id>/history on page load,
│   │                   message input + send button, SocketIO
│   │                   send_message / receive_message events,
│   │                   live notification badge for unread count.
│   │     ACCESS      : All authenticated users.
│   │     ROOM TYPES  : task_{task_id}  — User ↔ Volunteer
│   │                   admin_{admin_id}_vol_{vol_id} — Admin ↔ Vol
│   │                   admin_{admin_id}_user_{user_id} — Admin ↔ User
│   │
│   └── admin_panel.html
│         WHAT IT IS  : Admin user management panel.
│         CONTAINS    : Full user table with role badges, activate /
│                       deactivate toggle, role change dropdown,
│                       failed ingestions table (dead letter queue)
│                       with mark-as-reviewed button, pipeline
│                       status tracker per source_id.
│         ACCESS      : Admin only.
│
│
├── static/
│   ├── css/
│   │   ├── base.css
│   │   │     PURPOSE : Global styles applied to all pages.
│   │   │               Bootstrap overrides, custom navbar styling,
│   │   │               toast notification styles, utility classes.
│   │   │
│   │   ├── dashboard.css
│   │   │     PURPOSE : Admin dashboard-specific styles.
│   │   │               KPI card layout, chart container sizing,
│   │   │               priority table row urgency color coding
│   │   │               (red/orange/yellow by urgency score band).
│   │   │
│   │   ├── map.css
│   │   │     PURPOSE : Leaflet map layout (full-screen container),
│   │   │               custom marker styles, popup card styles,
│   │   │               map sidebar overlay styles.
│   │   │
│   │   ├── chat.css
│   │   │     PURPOSE : Chat room layout, message bubble styles
│   │   │               (own messages right-aligned, others left),
│   │   │               online indicator dot, scrollable message list.
│   │   │
│   │   └── volunteer.css
│   │         PURPOSE : Volunteer dashboard layout, task card styles,
│   │                   GPS active indicator, upload form styles.
│   │
│   ├── js/
│   │   ├── main.js
│   │   │     PURPOSE : Shared utilities used across all pages.
│   │   │     DOES    : getAuthHeaders() — returns Authorization header
│   │   │               with JWT from localStorage for all API calls.
│   │   │               showToast(message, type) — Bootstrap toast
│   │   │               notification system.
│   │   │               apiGet(url) / apiPost(url, data) — DRY fetch
│   │   │               wrappers that automatically attach JWT.
│   │   │               formatDate(iso) — human-readable date format.
│   │   │               handleAuthRedirect() — checks JWT on every
│   │   │               page load, redirects if expired or missing.
│   │   │
│   │   ├── auth.js
│   │   │     PURPOSE : Authentication logic for login and register pages.
│   │   │     DOES    : Handles login form submit → POST /api/auth/login
│   │   │               → stores JWT in localStorage → redirects to
│   │   │               correct dashboard by role.
│   │   │               Handles register form submit → POST
│   │   │               /api/auth/register → auto-login.
│   │   │               logout() — clears localStorage, redirects to /.
│   │   │               Populates navbar links based on role from JWT.
│   │   │
│   │   ├── dashboard.js
│   │   │     PURPOSE : Admin dashboard page logic.
│   │   │     DOES    : On load — fetches GET /api/needs to populate
│   │   │               priority needs table.
│   │   │               Renders Chart.js bar chart (needs by category).
│   │   │               Renders Chart.js line chart (weekly trend).
│   │   │               File upload widget — POST /api/upload with
│   │   │               multipart/form-data, shows progress indicator,
│   │   │               polls GET /api/admin/pipeline/<source_id>
│   │   │               every 3 seconds to show pipeline stage.
│   │   │               Assign button — POST /api/assign with need_id
│   │   │               and volunteer_id.
│   │   │
│   │   ├── map.js
│   │   │     PURPOSE : Leaflet.js interactive map logic.
│   │   │     DOES    : Initializes Leaflet map on OpenStreetMap tiles.
│   │   │               Fetches GET /api/needs to place need markers.
│   │   │               Fetches GET /api/volunteers/location to place
│   │   │               volunteer markers.
│   │   │               Connects to SocketIO, listens for
│   │   │               tracker_update events to move volunteer
│   │   │               markers in real-time without page refresh.
│   │   │               Color-codes need markers by urgency band:
│   │   │               red (>0.7), orange (0.4-0.7), yellow (<0.4).
│   │   │               On need marker click — opens popup with
│   │   │               description, urgency score, match button
│   │   │               that fetches GET /api/match/<need_id>.
│   │   │
│   │   ├── chat.js
│   │   │     PURPOSE : Real-time chat room client logic.
│   │   │     DOES    : On load — reads room_id from page, connects
│   │   │               to SocketIO, emits join event with room,
│   │   │               user_id, role.
│   │   │               Fetches GET /api/chat/<room_id>/history to
│   │   │               populate existing messages.
│   │   │               Send button → emits send_message event with
│   │   │               room, sender_id, content, role.
│   │   │               Listens for receive_message events to append
│   │   │               new messages to chat UI in real-time.
│   │   │               Auto-scrolls to bottom on new message.
│   │   │
│   │   └── volunteer.js
│   │         PURPOSE : Volunteer dashboard client logic.
│   │         DOES    : Fetches GET /api/volunteers/tasks to show
│   │                   active and history tasks.
│   │                   Accept button → POST /api/volunteers/accept
│   │                   Decline button → POST /api/volunteers/decline
│   │                   Complete button → POST /api/feedback/<task_id>
│   │                   with rating.
│   │                   GPS toggle — on enable, calls
│   │                   navigator.geolocation.watchPosition(),
│   │                   emits location_update via SocketIO every
│   │                   10 seconds with lat/lng.
│   │                   On disable — stops watchPosition, emits final
│   │                   location, marks volunteer as unavailable.
│   │
│   └── img/
│       └── logo.png
│             PURPOSE : Platform logo used in navbar and landing page.

---
---

# 7. BACKEND — EVERY FILE & ITS JOB

# ─────────────────────────────────────
# 7.1 ENTRY POINTS
# ─────────────────────────────────────

backend/
├── run.py
│     PURPOSE : Local development entry point only.
│               Not used in production (Procfile uses gunicorn directly).
│     DOES    : Imports create_app() from backend/app/__init__.py,
│               calls socketio.run(app, debug=True, port=5000).
│               eventlet.monkey_patch() is called before all imports
│               to patch stdlib for async compatibility.
│
├── celery_worker.py
│     PURPOSE : Celery application definition. Imported by:
│               - Celery worker process (in Procfile)
│               - Celery beat process (in Procfile)
│               - Task modules that need the @celery.task decorator
│     DOES    : Creates Celery instance with Redis broker + backend.
│               Sets task serializer, acks_late=True (tasks only
│               acknowledged after successful completion — prevents
│               data loss on worker crash).
│               Imports and registers the Celery Beat schedule from
│               backend/app/config/celery_beat.py.
│               Does NOT import Flask app (avoids circular imports).
│               Flask app context is created inside each task when
│               needed for DB access.
│
└── Procfile
      PURPOSE : Tells Render how to start all processes.
      CONTENTS:
        web:    gunicorn --worker-class eventlet -w 1 run:app
        worker: celery -A celery_worker.celery worker --loglevel=info
        beat:   celery -A celery_worker.celery beat --loglevel=info

      WHY -w 1: SocketIO + eventlet requires a single Gunicorn worker.
                Multiple workers would break SocketIO room state.
                Redis message queue is used instead for scaling.

# ─────────────────────────────────────
# 7.2 APP FACTORY & EXTENSIONS
# ─────────────────────────────────────

backend/app/
├── __init__.py
│     PURPOSE : Flask application factory. Creates and configures
│               the Flask app, registers all blueprints, initializes
│               all extensions, registers SocketIO event handlers.
│     DOES    : Calls eventlet.monkey_patch() at the very top.
│               create_app(config_name) function:
│                 - Creates Flask(__name__,
│                     template_folder="../../frontend/templates",
│                     static_folder="../../frontend/static")
│                 - Loads config from config.py by environment name
│                 - Calls db.init_app(), jwt.init_app(),
│                   socketio.init_app(), mail.init_app(),
│                   migrate.init_app(), CORS(app)
│                 - Registers all route blueprints with url_prefix
│                 - Imports routes/__init__.py for SocketIO handlers
│                 - Creates DB tables on first run (dev only)
│               app = create_app() at module level for Gunicorn.
│
└── extensions.py
      PURPOSE : Shared extension instances. Imported by both the
                app factory and any module that needs db, redis, etc.
                Exists to prevent circular imports — extensions are
                created here without an app, then initialized in
                create_app() using the init_app() pattern.
      CONTAINS: db         — SQLAlchemy instance
                jwt        — JWTManager instance
                socketio   — SocketIO instance
                mail       — Flask-Mail instance
                migrate    — Flask-Migrate instance
                get_redis() — Returns a connected Redis client,
                              created once and reused (singleton).
                              Reads REDIS_URL from environment.

# ─────────────────────────────────────
# 7.3 CONFIGURATION
# ─────────────────────────────────────

backend/app/
├── config.py
│     PURPOSE : All configuration classes for different environments.
│               Loaded by create_app() based on FLASK_ENV variable.
│     CLASSES :
│       Config (base)
│         - SECRET_KEY, DEBUG=False, TESTING=False
│         - SQLALCHEMY_DATABASE_URI (from env DATABASE_URL)
│         - SQLALCHEMY_TRACK_MODIFICATIONS = False
│         - SQLALCHEMY_ENGINE_OPTIONS (pool_pre_ping, pool_recycle)
│         - JWT_SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES (1 hour)
│         - JWT_TOKEN_LOCATION = ["headers", "cookies"]
│         - REDIS_URL, CELERY_BROKER_URL, CELERY_RESULT_BACKEND
│         - CELERY_TASK_SERIALIZER = "json"
│         - CELERY_TASK_ACKS_LATE = True
│         - MAX_CONTENT_LENGTH (16 MB file upload limit)
│         - ALLOWED_EXTENSIONS = {csv, xlsx, pdf, png, jpg, jpeg}
│         - CLOUDINARY_URL, CLOUDINARY_CLOUD_NAME, API_KEY, SECRET
│         - GOOGLE_VISION_KEY (base64 encoded service account JSON)
│         - MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USERNAME,
│           MAIL_PASSWORD, MAIL_DEFAULT_SENDER
│         - TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE
│         - SOCKETIO_MESSAGE_QUEUE = REDIS_URL
│
│       DevelopmentConfig(Config)
│         - DEBUG = True
│         - SQLALCHEMY_DATABASE_URI defaults to sqlite:///dev.db
│         - JWT_COOKIE_SECURE = False
│
│       ProductionConfig(Config)
│         - DEBUG = False
│         - SQLALCHEMY_DATABASE_URI must be PostgreSQL (Render)
│         - JWT_COOKIE_SECURE = True
│         - SESSION_COOKIE_SECURE = True
│
│       TestingConfig(Config)
│         - TESTING = True
│         - SQLALCHEMY_DATABASE_URI = sqlite:///:memory:
│         - JWT_ACCESS_TOKEN_EXPIRES = 60 seconds
│
│       config_map dict mapping string names to classes.
│
└── config/
    └── celery_beat.py
          PURPOSE : Celery Beat periodic task schedule.
                    Imported by celery_worker.py.
          SCHEDULES:
            priority.recompute_all
              → Runs every 15 minutes (900 seconds)
              → Re-scores ALL open needs with time escalation bonus
              → Handles urgency increase even without new data
              → Triggers re-match if any need crosses 0.85 threshold
            matching.expire_stale
              → Runs every 30 minutes (1800 seconds)
              → Checks all "assigned" tasks for response timeout
              → High urgency (0.8-1.0): expires after 15 minutes
              → Medium urgency (0.5-0.8): expires after 45 minutes
              → Low urgency (0.0-0.5): expires after 120 minutes
              → Re-queues expired matches for fresh matching

# ─────────────────────────────────────
# 7.4 ROUTES LAYER
# ─────────────────────────────────────

RULE: Routes only handle HTTP request parsing and response
      formatting. Zero algorithm logic. Zero direct DB queries
      (except simple lookups). Always delegate to services/.

backend/app/routes/
├── __init__.py
│     PURPOSE : SocketIO event handler registration.
│               Imported by create_app() after socketio is initialized.
│     EVENTS HANDLED:
│       on connect     — Client connects, validates JWT from query param
│       join           — Client joins a chat room (emit system message)
│       send_message   — Receives message, saves to DB via Message model,
│                        emits receive_message to the room
│       leave          — Client leaves room
│       location_update — Receives volunteer lat/lng, updates Volunteer
│                         model in DB, broadcasts tracker_update to all
│                         admin clients watching the map
│       disconnect     — Client disconnects, log event
│
├── pages.py
│     PURPOSE : Renders all HTML pages using render_template().
│               All routes in this file return HTML, not JSON.
│     ROUTES :
│       GET /
│         → render_template("index.html")
│         → Public, no auth required
│
│       GET /login
│         → render_template("login.html")
│         → Public
│
│       GET /register
│         → render_template("register.html")
│         → Public
│
│       GET /dashboard
│         → @jwt_required(locations=["cookies"])
│         → @role_required("admin")
│         → render_template("dashboard.html")
│
│       GET /map
│         → @jwt_required(locations=["cookies"])
│         → @role_required("admin")
│         → render_template("map.html")
│
│       GET /volunteer
│         → @jwt_required(locations=["cookies"])
│         → @role_required("volunteer")
│         → render_template("volunteer_dashboard.html")
│
│       GET /chat/<room_id>
│         → @jwt_required(locations=["cookies"])
│         → Any authenticated role
│         → render_template("chat.html", room_id=room_id)
│
│       GET /admin
│         → @jwt_required(locations=["cookies"])
│         → @role_required("admin")
│         → render_template("admin_panel.html")
│
│     HELPER : role_required(*roles) decorator — reads role from JWT
│              claims, redirects to /login if role not in allowed list.
│
├── auth.py
│     PURPOSE : Authentication API endpoints.
│     ROUTES :
│       POST /api/auth/register
│         → Validates request JSON (name, email, password, role)
│         → Checks if email already exists
│         → Creates User, hashes password
│         → If role == "volunteer", creates Volunteer profile
│         → Returns JWT token + role + name
│         → Status 201
│
│       POST /api/auth/login
│         → Validates credentials against User table
│         → Returns JWT token + role + name
│         → Status 200 or 401
│
│       GET /api/auth/me
│         → @jwt_required()
│         → Returns current user profile dict
│
├── needs.py
│     PURPOSE : Community needs CRUD API.
│     ROUTES :
│       GET /api/needs
│         → @jwt_required()
│         → Fetches top-K needs from Redis priority sorted set
│         → Enriches with DB details via joinedload
│         → Returns JSON list ordered by urgency_score desc
│
│       POST /api/needs
│         → @jwt_required() — user or volunteer
│         → Validates fields (category, description, severity,
│           volunteers_needed, location, lat, lng)
│         → Calls ingestion_service.process_manual_need()
│         → Returns created need dict
│         → Status 201
│
│       GET /api/needs/<id>
│         → @jwt_required()
│         → Returns single need detail with score breakdown
│
│       PATCH /api/needs/<id>/status
│         → @jwt_required() + @role_required("admin")
│         → Updates need status (open/assigned/completed)
│
├── volunteers.py
│     PURPOSE : Volunteer profile and GPS API.
│     ROUTES :
│       GET /api/volunteers/location
│         → @jwt_required() + admin role
│         → Returns all available volunteer lat/lng for map markers
│
│       POST /api/volunteers/location
│         → @jwt_required() + volunteer role
│         → Updates volunteer's lat/lng in DB
│         → Returns 200
│
│       PATCH /api/volunteers/profile
│         → @jwt_required() + volunteer role
│         → Updates skills, skills_vector, zone, is_available
│         → Invalidates Redis volunteer matrix cache
│
│       GET /api/volunteers/tasks
│         → @jwt_required() + volunteer role
│         → Returns active + history tasks for current volunteer
│
│       POST /api/volunteers/accept
│         → @jwt_required() + volunteer role
│         → Accepts a task_id, sets task.status = "in_progress"
│
│       POST /api/volunteers/decline
│         → @jwt_required() + volunteer role
│         → Declines task, triggers re-matching via Celery task
│
├── admin.py
│     PURPOSE : Admin-only management API.
│     ROUTES :
│       GET /api/admin/users
│         → @role_required("admin")
│         → Returns paginated user list with roles
│
│       PATCH /api/admin/users/<id>
│         → @role_required("admin")
│         → Updates user role or is_active status
│
│       GET /api/admin/dead-letters
│         → @role_required("admin")
│         → Returns failed_ingestions table (unreviewed first)
│
│       PATCH /api/admin/dead-letters/<id>/review
│         → @role_required("admin")
│         → Marks a failed ingestion as reviewed
│
│       GET /api/admin/pipeline/<source_id>
│         → @role_required("admin")
│         → Returns current pipeline stage from Redis for source_id
│
│       GET /api/admin/stats
│         → @role_required("admin")
│         → Returns KPI counts: total needs, assigned, completed,
│           avg resolution time, top categories
│
├── chat.py
│     PURPOSE : REST endpoints for chat history (SocketIO handles
│               real-time messaging, this handles history on page load).
│     ROUTES :
│       GET /api/chat/<room_id>/history
│         → @jwt_required()
│         → Returns last 50 messages for the room from messages table
│         → Ordered by created_at ascending
│         → Marks messages as is_read = True for current user
│
│       GET /api/notifications
│         → @jwt_required()
│         → Returns unread notifications for current user
│
│       PATCH /api/notifications/read
│         → @jwt_required()
│         → Marks all notifications as read for current user
│
├── upload.py
│     PURPOSE : File upload endpoint — triggers async Celery pipeline.
│     ROUTES :
│       POST /api/upload
│         → @jwt_required() — admin or volunteer role
│         → Validates file type and size
│         → Calls ingestion_service.process_upload(file, user_id)
│           which uploads to Cloudinary and queues Celery task
│         → Returns { source_id, file_url, status: "processing" }
│         → Frontend polls /api/admin/pipeline/<source_id> to track
│
│       POST /api/match/<need_id>
│         → @jwt_required() + admin role
│         → Calls matching_service.get_matches_for_need(need_id)
│         → Returns top-K volunteer matches with scores
│
│       POST /api/assign
│         → @jwt_required() + admin role
│         → Body: { need_id, volunteer_id }
│         → Calls matching_service.assign_volunteer()
│         → Creates Task, creates chat room, sends notifications
│         → Returns task dict
│
│       POST /api/feedback/<task_id>
│         → @jwt_required() — user or admin role
│         → Body: { rating }
│         → Calls feedback_service.record_task_outcome()
│         → Returns 200
│
└── health.py
      PURPOSE : Health check endpoint required by Render.
                Render pings this every 30 seconds to check service
                health. If it returns non-200, Render restarts the
                service. Checks both DB and Redis connectivity.
      ROUTES :
        GET /health
          → No auth required
          → Runs: db.session.execute("SELECT 1") to test DB
          → Runs: redis_client.ping() to test Redis
          → Returns { status, db, redis } JSON
          → 200 if all OK, 503 if any check fails

# ─────────────────────────────────────
# 7.5 SERVICES LAYER
# ─────────────────────────────────────

RULE: Services orchestrate. They call modules for computation
      and models for DB access. They never contain algorithm
      logic and never handle HTTP directly.

backend/app/services/
├── ingestion_service.py
│     PURPOSE : Orchestrates the full data ingestion flow from
│               file upload to DB save and pipeline trigger.
│     FUNCTIONS:
│       allowed_file(filename) → bool
│         Checks if file extension is in ALLOWED_EXTENSIONS.
│
│       process_upload(file, submitted_by) → dict
│         1. Validates file type
│         2. Generates unique source_id (UUID)
│         3. Uploads raw file to Cloudinary using cloudinary SDK
│            (permanent backup — Render has no persistent disk)
│         4. Gets the secure Cloudinary URL
│         5. If image/PDF: queues process_ocr_task.delay() with URL
│         6. If CSV/Excel: fetches file content, reads with Pandas,
│            iterates rows, queues run_ingestion_pipeline() per row
│         7. Returns { source_id, file_url, status: "processing" }
│
│       process_manual_need(data, submitted_by) → Need
│         For needs submitted via web form (not file upload).
│         1. Creates Need model instance from form data
│         2. Calls modules/priority.py compute_urgency()
│         3. Saves score and breakdown to Need
│         4. Saves Need to DB
│         5. Calls priority.add_to_priority_queue()
│         6. Returns saved Need object
│
├── matching_service.py
│     PURPOSE : Orchestrates volunteer-to-need matching and
│               task assignment.
│     FUNCTIONS:
│       get_matches_for_need(need_id, top_k=10) → list
│         1. Loads Need from DB
│         2. Queries available Volunteers using joinedload
│            (avoids N+1 query problem)
│         3. Calls modules/matching.py match_with_fallback()
│         4. Returns sorted match list with scores
│
│       assign_volunteer(need_id, volunteer_id, match_score) → Task
│         1. Loads Need and Volunteer from DB
│         2. Creates Task record with chat_room = "task_{need_id}"
│         3. Sets need.status = "assigned"
│         4. Sets volunteer.is_available = False
│         5. Commits to DB
│         6. Calls notification_service.notify_assignment()
│         7. Returns Task object
│
├── notification_service.py
│     PURPOSE : All notification dispatch — in-app, email, SMS.
│     FUNCTIONS:
│       notify_assignment(volunteer, need, task)
│         Sends assignment notification via all 3 channels.
│
│       notify_match_found(volunteer_id, need_id, score)
│         Notifies volunteer of a potential match (pre-assignment).
│
│       _save_notification(user_id, message, notif_type)
│         Saves Notification record to DB.
│         Emits SocketIO "notification" event to user's room.
│
│       _send_email(to, subject, body)
│         Uses Flask-Mail. Wraps in try/except — email failure
│         should never crash the main flow.
│
│       _send_sms(phone, body)
│         Uses Twilio REST client. Same try/except pattern.
│
└── feedback_service.py
      PURPOSE : Records task outcomes and drifts category weights
                using Exponential Moving Average (EMA).
      FUNCTIONS:
        record_task_outcome(task_id, volunteer_rating) → None
          1. Loads Task from DB
          2. Computes resolution_time_hrs from assigned_at → now
          3. Updates task.status = "completed", task.volunteer_rating
          4. Updates volunteer.rating (EMA, alpha=0.05)
          5. Increments volunteer.total_tasks
          6. Sets volunteer.is_available = True
          7. Updates CategoryFeedback record (EMA for avg_rating
             and avg_resolution_time)
          8. If resolution_time > SLA AND rating < 3.0:
             calls _drift_weights() to adjust category weights
          9. Calls priority.remove_from_queue(need_id)
         10. Sets need.status = "completed"
         11. Calls priority.recompute_relative_ranks()

        _drift_weights(category, history)
          Retrieves current weights from Redis for category.
          Falls back to CATEGORY_WEIGHTS defaults if not cached.
          Boosts severity weight by alpha (0.05), max 0.70.
          Boosts gap weight by alpha, max 0.60.
          Reduces frequency weight by 2*alpha, min 0.10.
          Re-normalizes all weights to sum to 1.0.
          Saves updated weights back to Redis with 30-day TTL.
          Updates CategoryFeedback DB record.

        get_adjusted_weights(category) → dict
          Returns current learned weights for a category.
          Checks Redis first (fast path).
          Falls back to CATEGORY_WEIGHTS defaults if Redis miss.

# ─────────────────────────────────────
# 7.6 MODULES LAYER (PURE ALGORITHMS)
# ─────────────────────────────────────

RULE: Modules are pure Python functions only. No Flask imports.
      No direct DB access. No HTTP. They receive data, compute,
      and return results. This makes them trivially unit testable.

backend/app/modules/
├── ocr.py
│     PURPOSE : Text extraction from images and PDFs.
│               Uses Google Cloud Vision API — works on Render
│               (no system binary required, unlike Tesseract).
│     FUNCTIONS:
│       extract_text_from_image(image_bytes) → str
│         Calls Google Cloud Vision annotate_image() with
│         TEXT_DETECTION feature. Returns extracted string.
│         Handles API errors gracefully (returns empty string).
│
│       extract_text_from_pdf(pdf_bytes) → str
│         Calls Google Cloud Vision with DOCUMENT_TEXT_DETECTION.
│         Joins all page text into single string.
│
│       NOTES: Google Cloud Vision free tier = 1000 units/month.
│              Service account JSON stored as base64 env var
│              GOOGLE_VISION_KEY (no file on Render disk).
│
├── cleaning.py
│     PURPOSE : Raw data normalization and validation using Pandas.
│               Pure Pandas — no Flask, no DB access.
│     FUNCTIONS:
│       clean_dataframe(df) → df
│         1. Drops exact duplicate rows
│         2. Strips leading/trailing whitespace from string columns
│         3. Lowercases text fields (description, category, location)
│         4. Fills missing severity with median of column
│         5. Fills missing category with "other"
│         6. Validates required columns are present
│         7. Adds is_valid column (True if all required fields present)
│         8. Returns cleaned DataFrame
│
│       validate_row(row) → bool
│         Checks a single row dict has required fields with
│         valid types. Used by pipeline task_clean to gate
│         bad rows to dead letter queue.
│
├── classification.py
│     PURPOSE : NLP category tagging using spaCy.
│               Model loaded ONCE at module level (not per-call).
│     MODULE LEVEL:
│       nlp = spacy.load("en_core_web_sm")
│       This loads the model once when Python imports the module.
│       Critical — loading inside a function causes severe slowdown.
│
│     FUNCTIONS:
│       classify_batch(texts: list[str]) → list[dict]
│         Uses nlp.pipe(texts, batch_size=32,
│                       disable=["parser", "ner"])
│         3-5x faster than calling nlp() in a loop.
│         Only text categorizer and tagger are active.
│         Returns list of { category, confidence } dicts.
│
│       extract_category(doc) → str
│         Takes a processed spaCy doc, returns top category string.
│         Falls back to "other" if doc.cats is empty.
│
├── priority.py
│     PURPOSE : Full 7-layer urgency score engine + Redis queue
│               management. This is the core intelligence of the
│               platform — determines which needs are most critical.
│
│     LAYER 1 — Input Normalization
│       normalize_severity(raw, reporter_trust) → float
│         raw_severity (1-10) divided by 10, multiplied by
│         reporter_trust_score (0.5-1.0 based on history).
│         Trust-weighting prevents inflation from bad actors.
│
│       normalize_frequency(count, window_hrs) → float
│         Frequency is a RATE (reports per hour), not a raw count.
│         10 reports in 1 hour >> 10 reports in 1 week.
│         Log-scaled: log1p(rate) / log1p(100) → 0 to 1.
│         Prevents large bursts from dominating completely.
│
│       normalize_gap(needed, available) → float
│         Deficit ratio: (needed - available) / needed.
│         0.0 = fully covered. 1.0 = completely uncovered.
│         Bounded between 0 and 1.
│
│     LAYER 2 — Category-Aware Weights
│       CATEGORY_WEIGHTS dict — different need types have
│       different urgency profiles:
│         medical:      severity=0.60, frequency=0.20, gap=0.20
│         food:         severity=0.30, frequency=0.40, gap=0.30
│         shelter:      severity=0.35, frequency=0.25, gap=0.40
│         education:    severity=0.20, frequency=0.35, gap=0.45
│         mental_health:severity=0.50, frequency=0.30, gap=0.20
│         default:      severity=0.40, frequency=0.30, gap=0.30
│       These are starting defaults that drift over time (Layer 7).
│
│     LAYER 3 — Time Escalation (Non-Linear Sigmoid)
│       compute_time_escalation(reported_at_ts, sla_hours) → float
│         Uses sigmoid curve — slow escalation at first,
│         steep as SLA deadline approaches, plateaus at 0.40.
│         progress = hours_open / sla_hours
│         sigmoid = 1 / (1 + e^(-6*(progress - 0.5)))
│         Returns 0.0 to 0.40 bonus.
│         SLA per category:
│           medical=4hrs, food=8hrs, shelter=12hrs,
│           education=48hrs, default=24hrs
│
│     LAYER 4 — Source Confidence
│       SOURCE_CONFIDENCE dict:
│         api=1.00, manual=1.00, csv_upload=0.90,
│         pdf_form=0.80, ocr_image=0.65, ocr_handwritten=0.50
│       OCR data is penalized because extraction errors are common.
│
│     LAYER 5 — Full Composite Score
│       compute_urgency(...) → dict
│         base = S×Wseverity + F×Wfrequency + G×Wgap
│         time_bonus = sigmoid time escalation (0-0.40)
│         confidence = source type multiplier
│         final = min(1.0, (base + time_bonus) × confidence)
│         Returns full breakdown dict so dashboard can show
│         WHY a need is urgent (which component is driving it).
│
│     LAYER 6 — Queue-Aware Relative Ranking
│       recompute_relative_ranks()
│         After any score update, computes percentile rank for
│         every active need in the Redis sorted set.
│         A score of 0.72 alone means nothing — but "top 5%
│         of active needs" is actionable.
│         Stored in Redis with 15-minute TTL.
│
│     LAYER 7 — Feedback-Driven Weight Drift
│       get_adjusted_weights(category) → dict
│         Checks Redis for learned weights first.
│         Falls back to CATEGORY_WEIGHTS defaults.
│       update_category_weights() called by feedback_service
│         when a task resolves poorly (EMA drift).
│
│     REDIS FUNCTIONS:
│       add_to_priority_queue(need_id, score) → None
│         r.zadd("sra:priority:active", {need_id: score})
│         O(log n). Shared across all Gunicorn workers.
│         Persistent across server restarts.
│
│       get_top_needs(k) → list
│         r.zrange("sra:priority:active", 0, k-1,
│                  withscores=True, desc=True)
│         O(log n + k). Returns top-k by score descending.
│
│       remove_from_queue(need_id) → None
│         r.zrem("sra:priority:active", need_id)
│         Called when need is completed or archived.
│
├── geo.py
│     PURPOSE : All geographic computation. Pure Python math.
│               No PostGIS. No external API. Render-compatible.
│     FUNCTIONS:
│       haversine(lat1, lon1, lat2, lon2) → float
│         Standard spherical Earth distance formula.
│         Returns distance in kilometers. Accurate for <300km.
│
│       get_search_radius(urgency_score) → float
│         Inversely scales search radius with urgency.
│         urgency=1.0 → radius=10 km (get someone NOW, nearby)
│         urgency=0.75 → radius=47 km
│         urgency=0.50 → radius=85 km
│         urgency=0.25 → radius=122 km
│         urgency=0.00 → radius=150 km (find BEST person)
│         Formula: 150 - (urgency × 140)
│
│       compute_geo_weight(distance_km, max_radius_km) → float
│         Converts distance to normalized 0-1 geo score.
│         Closer volunteer = higher score.
│         Linear decay: 1.0 - (distance / max_radius).
│         Returns 0.0 if outside radius.
│
│       geo_filter(need_lat, need_lng, radius_km, volunteers) → list
│         Returns subset of volunteers within radius.
│         Reduces candidate pool by 80-90% before cosine math.
│
├── matching.py
│     PURPOSE : Volunteer-to-need matching with dynamic weights,
│               Redis caching, and rural area fallback expansion.
│     FUNCTIONS:
│       get_dynamic_weights(urgency_score) → dict
│         Shifts skill/geo balance based on urgency.
│         urgency=1.0 → skill=0.40, geo=0.60 (speed wins)
│         urgency=0.75 → skill=0.50, geo=0.50
│         urgency=0.50 → skill=0.60, geo=0.40
│         urgency=0.25 → skill=0.70, geo=0.30
│         urgency=0.00 → skill=0.80, geo=0.20 (best match wins)
│         Weights always sum to 1.0.
│
│       get_volunteer_matrix(volunteers) → np.ndarray
│         Builds L2-normalized skill matrix from all volunteers.
│         Cached in Redis as pickle bytes (TTL 3600s).
│         Only recomputed on volunteer profile update.
│         Avoids 5M comparisons per match request at scale.
│
│       match_volunteers_to_need(need, volunteers, top_k=10,
│                                override_radius=None) → list
│         Full 3-gate matching pipeline:
│           Gate 1: Availability check (skip if is_available=False)
│           Gate 2: Dynamic geo filter (haversine vs radius)
│                   Reduces candidate pool by 80-90%.
│           Gate 3: Cosine similarity on remaining subset only.
│         Combines: skill_weight × cosine + geo_weight × geo_score
│         Applies value multiplier (1.0-1.25x for high-impact needs)
│         Returns sorted list of match dicts with full breakdown.
│
│       apply_value_multiplier(base_score, need_value) → float
│         Soft boost for high-impact needs.
│         need_value is normalized 0.0-1.0 (people affected).
│         Multiplier = 1.0 + (0.25 × need_value). Capped at 1.0.
│
│       match_with_fallback(need, volunteers,
│                           min_matches=3) → list
│         For low-density rural areas where radius finds too few.
│         Starts at urgency-determined base radius.
│         Expands in steps [25, 50, 100, 150] km until
│         min_matches threshold is met.
│         Returns whatever is available even if below threshold.
│
├── pipeline_state.py
│     PURPOSE : Track where each data submission is in the
│               processing pipeline. Stored in Redis.
│               Readable by admin dashboard in real-time.
│     STAGES  : extracted → cleaned → classified → scored →
│               matched → notified → completed → failed
│     FUNCTIONS:
│       set_stage(source_id, stage, meta=None)
│         Writes stage + timestamp + meta to Redis.
│         Key: sra:pipeline:{source_id}:stage
│         TTL: 7 days (auto-expires old records).
│
│       get_stage(source_id) → dict
│         Reads current stage from Redis.
│         Returns { stage, timestamp, meta } or { stage: "unknown" }
│
└── dead_letter.py
      PURPOSE : Handle data that fails validation or processing.
                Nothing is silently dropped — failed ingestions
                are stored for admin review.
      FUNCTIONS:
        send_to_dead_letter(source_id, reason, raw_data=None)
          (Also a Celery task with name "pipeline.dead_letter")
          1. Saves FailedIngestion record to PostgreSQL.
          2. Increments Redis counter sra:admin:dead_letter_count.
          3. Sets Redis key sra:dead_letter:{source_id} with reason.
          4. Admin dashboard reads counter to show badge alert.

# ─────────────────────────────────────
# 7.7 MODELS LAYER (DATABASE)
# ─────────────────────────────────────

RULE: Models contain SQLAlchemy column definitions, relationships,
      and simple to_dict() serialization only. Zero business logic.
      Zero algorithm code.

backend/app/models/
├── __init__.py
│     PURPOSE : Imports all models so Flask-Migrate can detect them.
│
├── user.py  →  TABLE: users
│     COLUMNS:
│       id             INTEGER PRIMARY KEY
│       name           VARCHAR(128) NOT NULL
│       email          VARCHAR(256) UNIQUE NOT NULL, INDEX
│       password_hash  VARCHAR(256) NOT NULL
│       role           ENUM(admin, user, volunteer) NOT NULL
│       phone          VARCHAR(20) NULLABLE
│       is_active      BOOLEAN DEFAULT True
│       created_at     DATETIME DEFAULT now()
│     RELATIONSHIPS:
│       volunteer_profile → Volunteer (one-to-one)
│       submitted_needs   → Need (one-to-many)
│       notifications     → Notification (one-to-many)
│       messages          → Message (one-to-many)
│     METHODS:
│       set_password(password) — bcrypt hash
│       check_password(password) → bool
│       to_dict() → dict (excludes password_hash)
│
├── volunteer.py  →  TABLE: volunteers
│     COLUMNS:
│       id                INTEGER PRIMARY KEY
│       user_id           INTEGER FK → users.id NOT NULL
│       skills            JSON (list of skill label strings)
│       skills_vector     JSON (pre-computed float array for cosine)
│       zone              VARCHAR(128) INDEX
│       lat               FLOAT
│       lng               FLOAT
│       is_available      BOOLEAN DEFAULT True
│       rating            FLOAT DEFAULT 5.0 (rolling EMA average)
│       total_tasks       INTEGER DEFAULT 0
│       reporter_trust_score FLOAT DEFAULT 1.0
│       updated_at        DATETIME
│     INDEXES:
│       idx_volunteer_geo_available (zone, is_available)
│       Composite index — most frequent query pattern:
│       "available volunteers in this zone"
│     RELATIONSHIPS:
│       user   → User (many-to-one, backref="volunteer_profile")
│       tasks  → Task (one-to-many)
│
├── need.py  →  TABLE: needs
│     COLUMNS:
│       id                INTEGER PRIMARY KEY
│       submitted_by      INTEGER FK → users.id NOT NULL
│       category          ENUM(medical,food,shelter,education,
│                              mental_health,other) NOT NULL
│       description       TEXT NOT NULL
│       severity          INTEGER (1-10, raw self-reported input)
│       frequency         INTEGER (total report count)
│       volunteers_needed INTEGER DEFAULT 1
│       location          VARCHAR(256)
│       zone              VARCHAR(128)
│       lat               FLOAT
│       lng               FLOAT
│       skills_vector     JSON (required skills as float array)
│       urgency_score     FLOAT DEFAULT 0.0 (computed 0.0-1.0)
│       score_breakdown   JSON (full component breakdown dict)
│       status            ENUM(open, assigned, completed)
│       source_type       VARCHAR(32) (csv,ocr_image,manual,api)
│       value_score       FLOAT DEFAULT 0.5 (impact value 0.0-1.0)
│       created_at        DATETIME DEFAULT now()
│       updated_at        DATETIME
│     INDEXES:
│       idx_need_status_priority (status, urgency_score)
│       Composite index — most frequent query pattern:
│       "open needs ordered by urgency" — eliminates full table scan.
│     RELATIONSHIPS:
│       submitter → User (many-to-one)
│       tasks     → Task (one-to-many)
│
├── task.py  →  TABLE: tasks
│     COLUMNS:
│       id                  INTEGER PRIMARY KEY
│       need_id             INTEGER FK → needs.id NOT NULL
│       volunteer_id        INTEGER FK → volunteers.id NOT NULL
│       assigned_at         DATETIME DEFAULT now()
│       status              ENUM(assigned, in_progress, completed,
│                                declined, rematching)
│       completed_at        DATETIME NULLABLE
│       volunteer_rating    FLOAT NULLABLE (1-5, submitted by user)
│       resolution_time_hrs FLOAT NULLABLE (computed on completion)
│       match_score         FLOAT NULLABLE (final matching score)
│       chat_room           VARCHAR(64) (e.g. "task_5")
│     RELATIONSHIPS:
│       need      → Need (many-to-one)
│       volunteer → Volunteer (many-to-one)
│
├── message.py  →  TABLE: messages
│     COLUMNS:
│       id         INTEGER PRIMARY KEY
│       room       VARCHAR(64) NOT NULL INDEX
│       sender_id  INTEGER FK → users.id NOT NULL
│       content    TEXT NOT NULL
│       created_at DATETIME DEFAULT now()
│       is_read    BOOLEAN DEFAULT False
│     ROOM PATTERNS:
│       task_{task_id}                    — User ↔ Volunteer
│       admin_{admin_id}_vol_{vol_id}     — Admin ↔ Volunteer
│       admin_{admin_id}_user_{user_id}   — Admin ↔ User
│
├── notification.py  →  TABLE: notifications
│     COLUMNS:
│       id                INTEGER PRIMARY KEY
│       user_id           INTEGER FK → users.id NOT NULL
│       message           TEXT NOT NULL
│       notification_type VARCHAR(32) DEFAULT "info"
│       is_read           BOOLEAN DEFAULT False
│       created_at        DATETIME DEFAULT now()
│
├── category_feedback.py  →  TABLE: category_feedback
│     COLUMNS:
│       id                   INTEGER PRIMARY KEY
│       category             VARCHAR(64) UNIQUE NOT NULL INDEX
│       avg_rating           FLOAT DEFAULT 0.0 (EMA)
│       avg_resolution_time  FLOAT DEFAULT 0.0 (EMA, in hours)
│       weight_severity      FLOAT DEFAULT 0.4 (drifted over time)
│       weight_frequency     FLOAT DEFAULT 0.3
│       weight_gap           FLOAT DEFAULT 0.3
│       total_tasks          INTEGER DEFAULT 0
│       updated_at           DATETIME
│     NOTE: This is the feedback memory of the system.
│           Weights stored here are the "learned" values that
│           override CATEGORY_WEIGHTS defaults after enough data.
│
└── failed_ingestion.py  →  TABLE: failed_ingestions
      COLUMNS:
        id          INTEGER PRIMARY KEY
        source_id   VARCHAR(128) NOT NULL
        reason      TEXT NOT NULL
        raw_data    JSON NULLABLE (original data before failure)
        created_at  DATETIME DEFAULT now()
        reviewed    BOOLEAN DEFAULT False
        reviewed_by INTEGER FK → users.id NULLABLE

# ─────────────────────────────────────
# 7.8 CELERY TASKS & PIPELINE
# ─────────────────────────────────────

backend/app/celery_tasks.py
  PURPOSE : All Celery task definitions — both the event-driven
            ingestion pipeline chain and the periodic Beat tasks.

  THE PIPELINE CHAIN:
    run_ingestion_pipeline(extracted_data, source_id)
      Builds and fires a Celery chain:
      task_clean → task_classify → task_score_priority
                 → task_match → task_notify
      Each task's return value is automatically passed to the next.
      If any step fails, only that step retries (not the whole chain).
      This is the event-driven processing model — fire and track.

  PIPELINE TASKS:
    task_clean (name="pipeline.clean")
      max_retries=3, countdown=5, acks_late=True
      DOES: Calls modules/cleaning.clean_dataframe()
            Sets pipeline stage to "extracted" then "cleaned"
            If data fails validation → sends to dead letter queue
            and stops the chain (does not retry validation failures).

    task_classify (name="pipeline.classify")
      max_retries=3, countdown=5, acks_late=True
      DOES: Calls modules/classification.classify_batch()
            on the cleaned description text.
            Adds category and confidence to payload.
            Sets stage to "classified".

    task_score_priority (name="pipeline.score")
      max_retries=3, countdown=5, acks_late=True
      DOES: Calls modules/priority.compute_urgency() with all
            cleaned fields (severity, frequency, gap, category,
            timestamp, source_type, reporter_trust).
            Calls priority.update_priority_queue() → Redis ZADD.
            Adds urgency_score and score_breakdown to payload.
            Sets stage to "scored".

    task_match (name="pipeline.match")
      max_retries=3, countdown=5, acks_late=True
      DOES: Creates Flask app context for DB access.
            Queries available volunteers with joinedload.
            Calls modules/matching.match_with_fallback().
            Adds matches list to payload.
            Sets stage to "matched".

    task_notify (name="pipeline.notify")
      max_retries=5, countdown=10, acks_late=True
      More retries because notifications are user-facing.
      DOES: Filters matches by MIN_SCORE threshold (0.45).
            For each match above threshold, queues
            send_notification_task.delay() separately so one
            failed SMS does not block the others.
            Sets stage to "notified".

  STANDALONE TASKS:
    send_notification_task (name="tasks.notify_volunteer")
      max_retries=5, countdown=10
      DOES: Calls notification_service.dispatch_to_volunteer()
            Sends email + SMS to a specific volunteer.

    process_ocr_task (name="tasks.process_ocr")
      max_retries=3, countdown=5
      DOES: Downloads file from Cloudinary URL.
            Calls modules/ocr.extract_text_from_image() or
            extract_text_from_pdf() based on file_type.
            Calls run_ingestion_pipeline() with extracted text.

  PERIODIC BEAT TASKS:
    recompute_all_priorities (name="priority.recompute_all")
      Schedule: every 900 seconds (15 minutes)
      DOES: Queries all open needs from DB.
            Re-runs compute_urgency() for each with current time.
            Updates Redis sorted set scores.
            If any need crosses 0.85 urgency threshold,
            immediately fires task_match for re-matching.
            Commits updated urgency_score to DB.
      WHY: Urgency changes over time even without new data.
           A need reported 6 hours ago with no volunteer is MORE
           urgent than when first filed. Sigmoid time bonus
           handles this — but only if scores are recomputed.

    expire_stale_matches (name="matching.expire_stale")
      Schedule: every 1800 seconds (30 minutes)
      DOES: Queries all tasks with status "assigned".
            Checks age against urgency-based expiry rule:
              High urgency (0.8-1.0) → expire after 15 min
              Medium urgency (0.5-0.8) → expire after 45 min
              Low urgency (0.0-0.5) → expire after 120 min
            If expired: sets status to "rematching",
            fires task_match.delay() to find new volunteer.
      WHY: Volunteer may not respond in time. System
           automatically re-queues rather than leaving a need
           stuck with an unresponsive volunteer.

# ─────────────────────────────────────
# 7.9 TESTS
# ─────────────────────────────────────

backend/tests/
├── conftest.py
│     PURPOSE : Pytest fixtures shared across all test files.
│     FIXTURES:
│       app  — Creates TestingConfig Flask app with in-memory SQLite.
│              Creates all DB tables. Yields app. Drops tables after.
│       client — Returns app.test_client() for HTTP requests.
│       db     — Yields db session, rolls back after each test.
│       auth_headers(role) — Returns Authorization header dict
│                            with a valid JWT for given role.
│
├── test_priority.py
│     TESTS:
│       test_normalize_severity_basic
│         → severity=10 returns 1.0, severity=5 returns 0.5
│       test_normalize_severity_trust_weighted
│         → severity=10 with trust=0.8 returns 0.8
│       test_normalize_frequency_rate_based
│         → 10 reports/1hr > 10 reports/24hrs
│       test_normalize_gap
│         → gap(5 needed, 0 available) = 1.0
│         → gap(5 needed, 5 available) = 0.0
│       test_compute_urgency_valid_range
│         → final_score always 0.0 to 1.0
│         → returns all required keys in breakdown dict
│       test_medical_scores_higher_than_education
│         → same inputs, medical urgency > education urgency
│       test_time_escalation_increases_with_age
│         → older need has higher time_bonus
│       test_source_confidence_ocr_lower_than_manual
│         → OCR data scores lower than manual entry
│
├── test_geo.py
│     TESTS:
│       test_haversine_same_point → 0.0
│       test_haversine_known_distance → London to Paris ~340km
│       test_dynamic_radius_high_urgency → urgency=1.0 → 10km
│       test_dynamic_radius_low_urgency → urgency=0.0 → 150km
│       test_dynamic_radius_inverse → high urgency < low urgency
│       test_geo_weight_closer_higher
│       test_geo_weight_outside_radius → 0.0
│
├── test_matching.py
│     TESTS:
│       test_dynamic_weights_sum_to_one → for all urgency values
│       test_high_urgency_geo_dominates → geo > skill at urgency=1
│       test_low_urgency_skill_dominates → skill > geo at urgency=0
│       test_value_multiplier_cap → never exceeds 1.0
│       test_fallback_expands_radius → returns results when base fails
│
├── test_routes.py
│     TESTS:
│       test_health_check → GET /health returns 200 or 503
│       test_register_user → POST /api/auth/register 201
│       test_register_duplicate_email → 409
│       test_login_valid → 200 + token
│       test_login_invalid → 401
│       test_get_needs_unauthenticated → 401
│       test_get_needs_authenticated → 200 + list
│       test_upload_wrong_file_type → 400
│
├── test_ingestion.py
│     TESTS:
│       test_allowed_file_valid_types
│       test_allowed_file_invalid_types
│       test_process_manual_need_saves_to_db
│       test_process_manual_need_computes_urgency_score
│
└── test_pipeline.py
      TESTS:
        test_pipeline_stage_set_and_get
        test_dead_letter_saves_to_db
        test_recompute_all_priorities_runs
        test_stale_match_detection

# ─────────────────────────────────────
# 7.10 MIGRATIONS
# ─────────────────────────────────────

backend/migrations/
│     PURPOSE : Flask-Migrate (Alembic) tracks all schema changes.
│     HOW IT WORKS:
│       flask db init      — Run once to create migrations/ folder
│       flask db migrate   — Auto-detects model changes, creates
│                            a new version file in migrations/versions/
│       flask db upgrade   — Applies pending migrations to DB
│       flask db downgrade — Rolls back one migration version
│     RENDER:
│       Add "flask db upgrade" to Render post-deploy hook so
│       schema is always up to date after each deployment.
│     COMMITTED TO GIT: Yes — migration version files are
│       committed so DB schema is reproducible on any machine.

---
---

# 8. DATABASE SCHEMA — ALL 8 TABLES

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: users                                                     │
├──────────────────┬──────────────┬─────────────────────────────  │
│ id               │ INTEGER PK   │                                │
│ name             │ VARCHAR(128) │                                │
│ email            │ VARCHAR(256) │ UNIQUE, INDEX                  │
│ password_hash    │ VARCHAR(256) │                                │
│ role             │ ENUM         │ admin / user / volunteer       │
│ phone            │ VARCHAR(20)  │ NULLABLE                       │
│ is_active        │ BOOLEAN      │ DEFAULT True                   │
│ created_at       │ DATETIME     │                                │
└──────────────────┴──────────────┴─────────────────────────────  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: volunteers                                                │
├──────────────────────┬──────────┬──────────────────────────── │
│ id                   │ INTEGER  │ PK                            │
│ user_id              │ INTEGER  │ FK → users.id                 │
│ skills               │ JSON     │ ["medical","teaching",...]    │
│ skills_vector        │ JSON     │ [0.1, 0.8, 0.0, ...]         │
│ zone                 │ VARCHAR  │ INDEX                          │
│ lat                  │ FLOAT    │                                │
│ lng                  │ FLOAT    │                                │
│ is_available         │ BOOLEAN  │ DEFAULT True                   │
│ rating               │ FLOAT    │ DEFAULT 5.0 (EMA rolling avg) │
│ total_tasks          │ INTEGER  │ DEFAULT 0                      │
│ reporter_trust_score │ FLOAT    │ DEFAULT 1.0                    │
│ updated_at           │ DATETIME │                                │
├──────────────────────┴──────────┴──────────────────────────── │
│ INDEX: idx_volunteer_geo_available (zone, is_available)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: needs                                                     │
├──────────────────┬──────────────┬───────────────────────────── │
│ id               │ INTEGER      │ PK                             │
│ submitted_by     │ INTEGER      │ FK → users.id                  │
│ category         │ ENUM         │ medical/food/shelter/...       │
│ description      │ TEXT         │                                │
│ severity         │ INTEGER      │ 1-10, raw input                │
│ frequency        │ INTEGER      │ total report count             │
│ volunteers_needed│ INTEGER      │ DEFAULT 1                      │
│ location         │ VARCHAR(256) │                                │
│ zone             │ VARCHAR(128) │                                │
│ lat              │ FLOAT        │                                │
│ lng              │ FLOAT        │                                │
│ skills_vector    │ JSON         │ required skills float array    │
│ urgency_score    │ FLOAT        │ computed 0.0-1.0               │
│ score_breakdown  │ JSON         │ full component breakdown        │
│ status           │ ENUM         │ open/assigned/completed        │
│ source_type      │ VARCHAR(32)  │ csv/ocr_image/manual/api       │
│ value_score      │ FLOAT        │ impact value 0.0-1.0           │
│ created_at       │ DATETIME     │                                │
│ updated_at       │ DATETIME     │                                │
├──────────────────┴──────────────┴───────────────────────────── │
│ INDEX: idx_need_status_priority (status, urgency_score)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: tasks                                                     │
├────────────────────┬──────────┬────────────────────────────── │
│ id                 │ INTEGER  │ PK                              │
│ need_id            │ INTEGER  │ FK → needs.id                   │
│ volunteer_id       │ INTEGER  │ FK → volunteers.id              │
│ assigned_at        │ DATETIME │                                  │
│ status             │ ENUM     │ assigned/in_progress/           │
│                    │          │ completed/declined/rematching   │
│ completed_at       │ DATETIME │ NULLABLE                        │
│ volunteer_rating   │ FLOAT    │ NULLABLE (1-5)                  │
│ resolution_time_hrs│ FLOAT    │ NULLABLE                        │
│ match_score        │ FLOAT    │ NULLABLE                        │
│ chat_room          │ VARCHAR  │ e.g. "task_5"                   │
└────────────────────┴──────────┴────────────────────────────── │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: messages                                                  │
├────────────────┬──────────────┬──────────────────────────────  │
│ id             │ INTEGER      │ PK                               │
│ room           │ VARCHAR(64)  │ INDEX                            │
│ sender_id      │ INTEGER      │ FK → users.id                    │
│ content        │ TEXT         │                                   │
│ created_at     │ DATETIME     │                                   │
│ is_read        │ BOOLEAN      │ DEFAULT False                     │
└────────────────┴──────────────┴──────────────────────────────  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: notifications                                             │
├───────────────────┬──────────────┬───────────────────────────  │
│ id                │ INTEGER      │ PK                            │
│ user_id           │ INTEGER      │ FK → users.id                 │
│ message           │ TEXT         │                               │
│ notification_type │ VARCHAR(32)  │ info / task / alert           │
│ is_read           │ BOOLEAN      │ DEFAULT False                 │
│ created_at        │ DATETIME     │                               │
└───────────────────┴──────────────┴───────────────────────────  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: category_feedback                                         │
├─────────────────────┬──────────┬──────────────────────────── │
│ id                  │ INTEGER  │ PK                              │
│ category            │ VARCHAR  │ UNIQUE, INDEX                   │
│ avg_rating          │ FLOAT    │ DEFAULT 0.0 (EMA)              │
│ avg_resolution_time │ FLOAT    │ DEFAULT 0.0 (EMA, hours)       │
│ weight_severity     │ FLOAT    │ DEFAULT 0.4 (drifts over time) │
│ weight_frequency    │ FLOAT    │ DEFAULT 0.3                     │
│ weight_gap          │ FLOAT    │ DEFAULT 0.3                     │
│ total_tasks         │ INTEGER  │ DEFAULT 0                       │
│ updated_at          │ DATETIME │                                  │
└─────────────────────┴──────────┴──────────────────────────── │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TABLE: failed_ingestions                                         │
├─────────────┬──────────────┬───────────────────────────────── │
│ id          │ INTEGER      │ PK                                  │
│ source_id   │ VARCHAR(128) │                                     │
│ reason      │ TEXT         │                                     │
│ raw_data    │ JSON         │ NULLABLE                            │
│ created_at  │ DATETIME     │                                     │
│ reviewed    │ BOOLEAN      │ DEFAULT False                       │
│ reviewed_by │ INTEGER      │ FK → users.id, NULLABLE            │
└─────────────┴──────────────┴───────────────────────────────── │
└─────────────────────────────────────────────────────────────────┘

---
---

# 9. API ENDPOINTS — FULL REFERENCE

  METHOD  ENDPOINT                            AUTH        ROLE
  ─────────────────────────────────────────────────────────────
  # AUTH
  POST    /api/auth/register                  No          Any
  POST    /api/auth/login                     No          Any
  GET     /api/auth/me                        JWT         Any

  # NEEDS
  GET     /api/needs                          JWT         Any
  POST    /api/needs                          JWT         user/volunteer
  GET     /api/needs/<id>                     JWT         Any
  PATCH   /api/needs/<id>/status              JWT         admin

  # UPLOAD & MATCHING
  POST    /api/upload                         JWT         admin/volunteer
  POST    /api/match/<need_id>                JWT         admin
  POST    /api/assign                         JWT         admin
  POST    /api/feedback/<task_id>             JWT         user/admin

  # VOLUNTEERS
  GET     /api/volunteers/location            JWT         admin
  POST    /api/volunteers/location            JWT         volunteer
  PATCH   /api/volunteers/profile             JWT         volunteer
  GET     /api/volunteers/tasks               JWT         volunteer
  POST    /api/volunteers/accept              JWT         volunteer
  POST    /api/volunteers/decline             JWT         volunteer

  # ADMIN
  GET     /api/admin/users                    JWT         admin
  PATCH   /api/admin/users/<id>               JWT         admin
  GET     /api/admin/dead-letters             JWT         admin
  PATCH   /api/admin/dead-letters/<id>/review JWT         admin
  GET     /api/admin/pipeline/<source_id>     JWT         admin
  GET     /api/admin/stats                    JWT         admin

  # CHAT & NOTIFICATIONS
  GET     /api/chat/<room_id>/history         JWT         Any
  GET     /api/notifications                  JWT         Any
  PATCH   /api/notifications/read             JWT         Any

  # SYSTEM
  GET     /health                             No          None

---
---

# 10. SOCKETIO EVENTS — FULL REFERENCE

  CLIENT → SERVER EVENTS:
  ─────────────────────────────────────────────────────────────
  join
    Data   : { room: str, user_id: int, role: str }
    Action : Joins SocketIO room, emits system message to room

  send_message
    Data   : { room: str, sender_id: int, content: str,
               role: str }
    Action : Saves to messages table, emits receive_message to room

  leave
    Data   : { room: str }
    Action : Leaves SocketIO room

  location_update
    Data   : { volunteer_id: int, lat: float, lng: float }
    Action : Updates volunteer lat/lng in DB,
             broadcasts tracker_update to all clients

  disconnect
    Data   : None
    Action : Logs disconnection

  SERVER → CLIENT EVENTS:
  ─────────────────────────────────────────────────────────────
  receive_message
    Data   : { sender: int, content: str,
               time: str (ISO), role: str }
    Who    : All clients in the room

  tracker_update
    Data   : { volunteer_id: int, lat: float, lng: float }
    Who    : All clients (broadcast) — map.js moves marker

  notification
    Data   : { message: str, type: str }
    Who    : Specific user room "user_{user_id}"

  ROOM NAMING CONVENTION:
    task_{task_id}                   — User ↔ Volunteer chat
    admin_{admin_id}_vol_{vol_id}    — Admin ↔ Volunteer chat
    admin_{admin_id}_user_{user_id}  — Admin ↔ User chat
    user_{user_id}                   — Private notification channel

---
---

# 11. REDIS KEY CONVENTION

  Pattern: sra:{entity}:{id}:{field}

  KEY                                      TTL      PURPOSE
  ─────────────────────────────────────────────────────────
  sra:priority:active                      None     Priority sorted set
                                                    (ZADD, ZRANGE)
  sra:priority:{need_id}:percentile        900s     Percentile rank
                                                    (recomputed every 15min)
  sra:matching:volunteer_matrix            3600s    Pickled numpy matrix
                                                    Invalidated on profile update
  sra:volunteer:{vol_id}:profile           1800s    Cached volunteer dict
  sra:need:{need_id}:detail                1800s    Cached need detail dict
  sra:geo:{zone}:volunteers                600s     Volunteers in zone
  sra:weights:{category}                   2592000s Learned category weights
                                                    (30 days)
  sra:pipeline:{source_id}:stage           604800s  Pipeline stage tracker
                                                    (7 days)
  sra:dead_letter:{source_id}              86400s   Dead letter reason
                                                    (1 day)
  sra:admin:dead_letter_count              None     Running failed count
                                                    (dashboard badge)

---
---

# 12. DATA FLOW — END TO END

  STEP 1 — INPUT
    User / Volunteer / Admin uploads CSV, image, PDF,
    or submits a need via web form.

  STEP 2 — UPLOAD & STORE
    POST /api/upload received by routes/upload.py.
    Delegates to ingestion_service.process_upload().
    Raw file uploaded to Cloudinary (permanent backup).
    Render has ephemeral disk — no local file writes.
    Celery task queued (non-blocking response to user).
    Frontend gets source_id immediately.

  STEP 3 — OCR (if image or PDF)
    process_ocr_task Celery task runs in background.
    Calls modules/ocr.py → Google Cloud Vision API.
    Returns extracted text string.
    Feeds into run_ingestion_pipeline().

  STEP 4 — PARSE (if CSV or Excel)
    ingestion_service reads file with Pandas.
    Iterates rows, queues one pipeline per row.

  STEP 5 — CLEAN (task_clean)
    modules/cleaning.clean_dataframe() runs.
    Deduplication, whitespace stripping, normalization.
    Validation — invalid rows sent to dead letter queue.
    Pipeline stage set to "cleaned".

  STEP 6 — NLP CLASSIFY (task_classify)
    modules/classification.classify_batch() runs.
    spaCy nlp.pipe() — batch, 3-5x faster than loop.
    Assigns category and confidence to data.
    Pipeline stage set to "classified".

  STEP 7 — PRIORITY SCORE (task_score_priority)
    modules/priority.compute_urgency() runs.
    7-layer scoring:
      Layer 1: Normalize inputs (trust-weighted severity,
               log-scaled frequency rate, deficit-ratio gap)
      Layer 2: Category-aware weights (medical ≠ education)
      Layer 3: Sigmoid time escalation (SLA-aware per category)
      Layer 4: Source confidence multiplier (OCR penalized)
      Layer 5: Full composite score (0.0-1.0)
      Layer 6: Queue-aware percentile rank
      Layer 7: Feedback-drifted weights (self-calibrating)
    Redis ZADD update — O(log n).
    Pipeline stage set to "scored".

  STEP 8 — GEO FILTER (inside task_match)
    modules/geo.get_search_radius() determines radius
    from urgency score (10km to 150km inversely).
    modules/geo.haversine() for each available volunteer.
    80-90% candidate reduction before expensive cosine math.

  STEP 9 — MATCH (task_match)
    modules/matching.match_with_fallback() runs.
    Gate 1: availability check.
    Gate 2: dynamic geo filter.
    Gate 3: cosine similarity on geo-filtered subset.
    Skill/geo weights adapt to urgency (dynamic weights).
    Value multiplier applied for high-impact needs.
    Fallback radius expansion for rural low-density areas.
    Pipeline stage set to "matched".

  STEP 10 — NOTIFY (task_notify)
    Matches above 0.45 score trigger notification.
    send_notification_task queued per volunteer.
    notification_service: email via Flask-Mail,
    SMS via Twilio, in-app via SocketIO emit.
    Pipeline stage set to "notified".

  STEP 11 — TASK ASSIGNMENT
    Admin reviews matches on dashboard or map.
    Clicks Assign → POST /api/assign.
    matching_service.assign_volunteer() creates Task.
    Need status → "assigned". Volunteer is_available → False.
    Chat room created: task_{task_id}.
    Volunteer notified of assignment.

  STEP 12 — LIVE TRACKING & CHAT
    Volunteer accepts task, enables GPS toggle in browser.
    volunteer.js calls navigator.geolocation.watchPosition().
    location_update SocketIO event sent every 10 seconds.
    Server updates volunteer lat/lng in DB.
    Server broadcasts tracker_update to all admin clients.
    map.js moves volunteer marker in real-time on admin map.
    SocketIO chat room open for User ↔ Volunteer messaging.

  STEP 13 — COMPLETION & FEEDBACK
    Volunteer marks task complete (volunteer dashboard).
    User / Admin rates outcome (1-5 stars).
    feedback_service.record_task_outcome() runs:
      - Computes resolution_time_hrs
      - Updates volunteer rating (EMA, alpha=0.05)
      - Updates CategoryFeedback table
      - If resolution > SLA and rating < 3.0: drifts weights
      - Removes need from Redis priority queue
      - Recomputes relative percentile ranks

  STEP 14 — PERIODIC BACKGROUND (Celery Beat)
    Every 15 min: recompute_all_priorities()
      Re-scores all open needs with time escalation.
      Triggers re-match for any that cross 0.85 threshold.
    Every 30 min: expire_stale_matches()
      Checks assigned tasks for response timeout.
      Re-queues expired matches for fresh matching.

---
---

# 13. PRIORITY ENGINE — HOW IT WORKS

  Goal: Determine which community needs are most critical,
        dynamically and fairly, even as data keeps changing.

  FORMULA:
    S = normalize_severity(raw, reporter_trust)
    F = normalize_frequency(count, window_hours)
    G = normalize_gap(needed, available)
    weights = get_adjusted_weights(category)  ← learned over time
    base = S×Wseverity + F×Wfrequency + G×Wgap
    time_bonus = sigmoid((hours_open/sla_hours - 0.5) × 6) × 0.40
    confidence = SOURCE_CONFIDENCE[source_type]
    final = min(1.0, (base + time_bonus) × confidence)

  CATEGORY WEIGHTS (starting defaults, drift over time):
    medical:      severity=0.60, frequency=0.20, gap=0.20
    food:         severity=0.30, frequency=0.40, gap=0.30
    shelter:      severity=0.35, frequency=0.25, gap=0.40
    education:    severity=0.20, frequency=0.35, gap=0.45
    mental_health:severity=0.50, frequency=0.30, gap=0.20

  SLA PER CATEGORY:
    medical=4hrs, food=8hrs, shelter=12hrs,
    education=48hrs, default=24hrs

  SOURCE CONFIDENCE:
    api=1.00, manual=1.00, csv_upload=0.90,
    pdf_form=0.80, ocr_image=0.65, ocr_handwritten=0.50

  REDIS STORAGE:
    ZADD sra:priority:active {need_id: final_score}  O(log n)
    ZRANGE ... WITHSCORES REV → top-K                O(log n + k)

  SELF-IMPROVEMENT:
    After each completed task, if resolution_time > SLA
    and volunteer_rating < 3.0, category weights drift
    toward more accurate values using EMA (alpha=0.05).
    After ~20 tasks per category, weights reflect real-world
    urgency patterns for that NGO's community.

---
---

# 14. MATCHING ENGINE — HOW IT WORKS

  Goal: Find the best available volunteer for each need,
        balancing skill match and physical proximity based
        on how urgent the need is.

  SEARCH RADIUS (inversely scales with urgency):
    urgency=1.00 → 10 km   (emergency — get someone close NOW)
    urgency=0.75 → 47 km
    urgency=0.50 → 85 km
    urgency=0.25 → 122 km
    urgency=0.00 → 150 km  (low urgency — find BEST person)

  DYNAMIC WEIGHTS (shift with urgency):
    urgency=1.00 → skill=0.40, geo=0.60  (proximity dominates)
    urgency=0.75 → skill=0.50, geo=0.50
    urgency=0.50 → skill=0.60, geo=0.40
    urgency=0.25 → skill=0.70, geo=0.30
    urgency=0.00 → skill=0.80, geo=0.20  (skill dominates)

  MATCH SCORE:
    base = (skill_weight × cosine_similarity(need_vec, vol_vec))
         + (geo_weight × geo_weight_from_distance)
    final = apply_value_multiplier(base, need.value_score)

  THREE GATES:
    Gate 1: is_available check   — O(1) per volunteer
    Gate 2: dynamic geo filter   — O(n) haversine, 80-90% reduction
    Gate 3: cosine similarity    — Only on remaining 10-20% subset

  RURAL FALLBACK:
    If geo-filtered pool has < 3 volunteers:
    Expand radius in steps [25, 50, 100, 150] km until
    min_matches threshold is met.
    Returns whatever is available even below threshold.

  REDIS CACHE:
    Volunteer skill matrix pre-computed and cached.
    Key: sra:matching:volunteer_matrix — TTL 3600s.
    Invalidated when any volunteer updates their profile.
    Prevents 5M comparisons per match request at scale.

---
---

# 15. CELERY PIPELINE — HOW IT WORKS

  Architecture: Event-driven chain — each step triggers the next.
  Failure model: Only the failed step retries, not the whole chain.

  CHAIN:
    task_clean → task_classify → task_score_priority
              → task_match → task_notify

  RETRY POLICY:
    All tasks: autoretry_for=(Exception,), acks_late=True
    task_clean:             max_retries=3, countdown=5s
    task_classify:          max_retries=3, countdown=5s
    task_score_priority:    max_retries=3, countdown=5s
    task_match:             max_retries=3, countdown=5s
    task_notify:            max_retries=5, countdown=10s (user-facing)
    send_notification_task: max_retries=5, countdown=10s

  FAILURE HANDLING:
    Validation failures (bad data) → dead letter queue.
    Do NOT retry validation failures — data won't become valid.
    All other failures → retry with countdown backoff.
    After max_retries exhausted → Celery marks task as FAILED.
    Admin can see pipeline stage stuck at any step.

  BEAT SCHEDULE:
    priority.recompute_all  → every 900s  (15 min)
    matching.expire_stale   → every 1800s (30 min)

---
---

# 16. DEPLOYMENT — RENDER CHECKLIST

  REQUIRED FILES:
    backend/Procfile       → Process definitions for Render
    backend/requirements.txt → All dependencies
    .env.example           → Template for env vars
    render.yaml            → Render service configuration

  PROCFILE CONTENTS:
    web:    gunicorn --worker-class eventlet -w 1 run:app
    worker: celery -A celery_worker.celery worker --loglevel=info
    beat:   celery -A celery_worker.celery beat --loglevel=info

  RENDER SERVICES TO CREATE:
    1. Web Service (Python) — runs "web" from Procfile
    2. Worker Service (Python) — runs "worker" from Procfile
    3. Beat Service (Python) — runs "beat" from Procfile
    4. PostgreSQL Add-on — copy DATABASE_URL to env vars
    5. Redis Add-on — copy REDIS_URL to env vars

  BUILD COMMAND:
    pip install -r backend/requirements.txt &&
    python -m spacy download en_core_web_sm

  POST-DEPLOY HOOK:
    flask db upgrade

  CRITICAL DO-NOTs FOR RENDER:
    ✗ Do NOT use Tesseract → use Google Cloud Vision API
    ✗ Do NOT write files to disk → use Cloudinary
    ✗ Do NOT use in-memory heapq → use Redis ZADD
    ✗ Do NOT use SQLite in production → use Render PostgreSQL
    ✗ Do NOT hardcode secrets → always read from environment
    ✗ Do NOT use multiple Gunicorn workers → SocketIO needs -w 1

---
---

# 17. ENVIRONMENT VARIABLES REFERENCE

  VARIABLE               REQUIRED  DESCRIPTION
  ─────────────────────────────────────────────────────────────────
  SECRET_KEY             YES       Flask session signing key (32 char random)
  JWT_SECRET_KEY         YES       JWT signing key (32 char random)
  FLASK_ENV              YES       development / production / testing
  DATABASE_URL           YES       postgresql://... (Render) or sqlite:///dev.db
  REDIS_URL              YES       redis://... (Render Redis)
  CELERY_BROKER_URL      YES       Same as REDIS_URL
  CELERY_RESULT_BACKEND  YES       Same as REDIS_URL
  GOOGLE_VISION_KEY      YES       Base64-encoded service account JSON
  CLOUDINARY_URL         YES       cloudinary://api_key:secret@cloud_name
  CLOUDINARY_CLOUD_NAME  YES       Cloudinary cloud name
  CLOUDINARY_API_KEY     YES       Cloudinary API key
  CLOUDINARY_API_SECRET  YES       Cloudinary API secret
  TWILIO_SID             NO        Twilio Account SID (SMS optional)
  TWILIO_TOKEN           NO        Twilio Auth Token
  TWILIO_PHONE           NO        Twilio phone number (+1234567890)
  MAIL_SERVER            NO        smtp.gmail.com (email optional)
  MAIL_PORT              NO        587
  MAIL_USE_TLS           NO        True
  MAIL_USERNAME          NO        your@gmail.com
  MAIL_PASSWORD          NO        Gmail app password
  MAIL_DEFAULT_SENDER    NO        your@gmail.com
  JWT_ACCESS_TOKEN_EXPIRES NO      Token TTL in seconds (default 3600)
  MAX_CONTENT_LENGTH     NO        Max upload size in bytes (default 16MB)

---
---

# 18. KEY DESIGN DECISIONS & WHY

  DECISION: Render-compatible monorepo (frontend/ + backend/)
  WHY: Single Git repo, single Render web service.
       Flask reads templates and static from frontend/ via
       relative paths in template_folder and static_folder.
       No separate deployment needed for frontend.

  DECISION: Gunicorn with -w 1 (single worker)
  WHY: Flask-SocketIO with eventlet requires single worker.
       Multiple workers would lose SocketIO room state between
       requests. Redis message queue handles concurrency instead.

  DECISION: Redis Sorted Set (ZADD) instead of Python heapq
  WHY: heapq is in-memory and process-local. Each Gunicorn
       worker would have its own separate heap. Lost on restart.
       Redis ZADD is shared across all workers, persistent,
       and O(log n) — same algorithmic complexity as heapq.

  DECISION: Google Cloud Vision instead of Tesseract
  WHY: Tesseract is a C binary that cannot be installed on
       Render's managed Python environment. Google Cloud Vision
       is a pure API call — works anywhere with internet access.
       Free tier: 1000 units/month (sufficient for hackathon).

  DECISION: Cloudinary for file storage
  WHY: Render's file system is ephemeral — files written to
       disk are deleted on each deploy or restart. Cloudinary
       provides permanent URL-accessible storage with a free tier.

  DECISION: routes/ → services/ → modules/ → models/ separation
  WHY: routes/ stay thin — only HTTP in/out.
       services/ orchestrate — call modules for math, models for DB.
       modules/ stay pure — no Flask, no DB, trivially testable.
       models/ stay clean — only SQLAlchemy, no business logic.
       This means you can unit test priority.py without
       starting Flask or connecting to a database.

  DECISION: joinedload() instead of lazy loading
  WHY: Lazy loading causes N+1 queries — one query to get
       volunteers, then one more per volunteer to get their skills.
       joinedload() fetches everything in a single SQL JOIN.
       Critical for matching — we query all volunteers at once.

  DECISION: nlp.pipe() with model loaded at module level
  WHY: Loading spaCy model inside a function re-loads it on
       every call — catastrophic performance hit (seconds per call).
       Module-level load happens once per Python process.
       nlp.pipe() processes a batch of texts 3-5x faster than
       calling nlp() in a loop.

  DECISION: Celery chain instead of single monolithic task
  WHY: If one step fails, only that step retries — not the
       whole pipeline from scratch. OCR failure shouldn't
       force re-cleaning of already-clean data.
       Dead letter queue catches validation failures without
       polluting the retry system.

  DECISION: EMA (alpha=0.05) for weight drift
  WHY: Alpha=0.05 means each new data point contributes 5%
       to the running average. After ~20 data points, the
       weights reflect real observed patterns. Slow enough
       that one bad outcome doesn't swing weights wildly.
       Self-correcting over time without any ML infrastructure.

  DECISION: Dynamic radius inversely proportional to urgency
  WHY: High urgency needs a volunteer NOW — better to have a
       slightly less skilled volunteer nearby than the best
       volunteer 200km away. Low urgency can afford to wait
       for the best match regardless of distance.
       This is semantically correct: urgency and distance
       constraints are inversely related.

  DECISION: Sigmoid time escalation instead of linear bonus
  WHY: Linear (+0.01/hr) is too gentle early and can cause
       overflow if uncapped. Sigmoid is slow at start (just
       reported, volunteers being found), steep in the middle
       (getting concerning), and plateaus at 0.40 cap
       (time alone cannot make a trivial need critical).
       SLA per category makes medical (4hr) escalate faster
       than education (48hr) — semantically correct.

  DECISION: Source confidence multiplier
  WHY: OCR'd handwritten forms have higher error rates than
       direct API submissions. Penalizing OCR data (0.65×)
       means an OCR-reported severity=10 is treated with
       appropriate skepticism rather than full weight.
       This prevents bad OCR from artificially inflating
       urgency scores and triggering unnecessary responses.

---
---

Last Updated   : Based on system_design_improved.pdf +
                 changes_to_be_made_in_plan.pdf +
                 file_structure.pdf combined and reconciled.
Architecture   : Monorepo, Render-compatible, production-ready.
Status         : FINAL — Use this as reference during build.

---
```
