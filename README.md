# Smart Resource Allocation (SRA)

A Flask + React monorepo for NGO volunteer coordination. Ingests community need reports from CSV/Excel/image/PDF, scores them by urgency, matches volunteers via geo+skill, tracks tasks with real-time chat and GPS, and displays everything on a live map.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User Roles](#user-roles)
3. [Prerequisites](#prerequisites)
4. [Quick Start — Local Development](#quick-start--local-development)
5. [Environment Variables](#environment-variables)
6. [Running the Backend](#running-the-backend)
7. [Running the Frontend](#running-the-frontend)
8. [Database Migrations](#database-migrations)
9. [Running with Docker Compose](#running-with-docker-compose)
10. [Deploying to Render](#deploying-to-render)
11. [Admin Registration Flow](#admin-registration-flow)
12. [Project Structure](#project-structure)
13. [Testing](#testing)
14. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Browser
  │
  └─ React SPA (Vite) ── /app (served by Flask)
       │
       └─ /api/* ──► Flask (Gunicorn + SocketIO/eventlet)
                        │
                        ├─ PostgreSQL  (SQLAlchemy + Flask-Migrate)
                        ├─ Redis       (priority queue, pipeline state, Celery broker)
                        └─ Celery      (async ingestion pipeline, beat scheduler)
```

---

## User Roles

| Role | Routes | Capabilities |
|---|---|---|
| **Community Member** (`user`) | `/user`, `/volunteer/map`, `/chat/*` | Submit community needs, view affected-areas map (read-only), chat |
| **Volunteer** (`volunteer`) | `/volunteer`, `/volunteer/map`, `/chat/*` | View & manage assigned tasks, GPS tracking, restricted map of affected areas, upload data files |
| **Admin** (`admin`) | `/dashboard`, `/map`, `/admin`, `/chat/*` | Full stats dashboard, live map with match/assign controls, user management, NGO application review, dead-letter queue, pipeline tracker |

> **Admin accounts are not self-serve.** NGOs apply via `/register/admin`, upload proof of registration, and are reviewed by a superadmin before activation.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | 3.12 recommended |
| Node.js | 20+ | LTS recommended |
| PostgreSQL | 14+ | Local or managed (e.g. Render Postgres) |
| Redis | 7+ | Required for Celery and priority queue |
| Git | any | — |

Optional:
- **Cloudinary** — proof-of-registration file storage (falls back to local `backend/uploads/`)
- **Google Gemini API key** — OCR on uploaded images/PDFs (falls back to pypdf text extraction)

---

## Quick Start — Local Development

### Windows

```bat
:: 1. Clone
git clone <your-repo-url>
cd smart-resource-allocation

:: 2. Set up environment
copy .env.example .env
notepad .env

:: 3. Setup (creates venv, installs deps, downloads spaCy model)
setup.bat

:: 4. Start Redis (WSL or Windows port from github.com/tporadowski/redis)

:: 5. Backend (terminal 1)
start.bat

:: 6. Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### macOS / Linux

```bash
# 1. Clone
git clone <your-repo-url>
cd smart-resource-allocation

# 2. Set up environment
cp .env.example .env
nano .env

# 3. Setup
chmod +x setup.sh start.sh
./setup.sh

# 4. Start Redis (terminal 1)
redis-server

# 5. Backend (terminal 2)
./start.sh

# 6. Frontend (terminal 3)
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```dotenv
# Required
FLASK_ENV=development
SECRET_KEY=<python -c "import secrets; print(secrets.token_hex(32))">
JWT_SECRET_KEY=<another random hex string>
DATABASE_URL=postgresql://postgres:password@localhost:5432/sra_db
REDIS_URL=redis://localhost:6379/0

# Optional – OCR
GEMINI_API_KEY=

# Optional – File storage (falls back to local /uploads if not set)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Optional – Email notifications
MAIL_USERNAME=
MAIL_PASSWORD=

# Optional – SMS notifications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

---

## Running the Backend

```bash
cd backend

# Activate virtual environment
source .venv/bin/activate          # Mac/Linux
.venv\Scripts\activate             # Windows

# Run Flask (includes SocketIO)
python run.py
# → http://0.0.0.0:5000
```

### Celery (async ingestion pipeline — optional for basic testing)

```bash
# In separate terminals from backend/

# Worker
celery -A celery_worker.celery worker --loglevel=info

# Beat scheduler (periodic re-scoring)
celery -A celery_worker.celery beat --loglevel=info
```

Redis must be running before Celery starts.

---

## Running the Frontend

```bash
cd frontend
npm install        # first time only
npm run dev        # → http://localhost:5173 with HMR + API proxy to :5000
npm run build      # production build → frontend/templates/app.html
```

---

## Database Migrations

```bash
cd backend
source .venv/bin/activate

# First time (new database)
flask db init
flask db migrate -m "initial schema"
flask db upgrade

# After pulling changes that add model columns
flask db migrate -m "describe change"
flask db upgrade
```

> The `ngo_registrations` table is new in this version. If upgrading from an older checkout, run `flask db migrate && flask db upgrade` before starting the server.

---

## Running with Docker Compose

```bash
cp .env.example .env   # fill in SECRET_KEY, JWT_SECRET_KEY at minimum
docker compose up --build
```

This starts: Postgres, Redis, Flask web, Celery worker, Celery beat. First boot runs `flask db upgrade` automatically.

Frontend: run `npm run dev` from `frontend/` separately, or build first (`npm run build`) and access the SPA via Flask at http://localhost:5000/app.

---

## Deploying to Render

`render.yaml` defines three services (web, worker, beat) plus a Postgres add-on.

1. Push repo to GitHub.
2. Render dashboard → New → Blueprint → select repo.
3. Add environment variables: `SECRET_KEY`, `JWT_SECRET_KEY`, `REDIS_URL` (from Render Redis add-on), optionally `GEMINI_API_KEY` and `CLOUDINARY_*`.
4. Deploy — Render runs `flask db upgrade` as `preDeployCommand`.

Use `gunicorn -w 1 -k eventlet` (already set in Procfile) so SocketIO works on the free tier.

---

## Admin Registration Flow

```
NGO fills /register/admin
  ├── name, email, password
  ├── NGO name
  ├── NGO Head ID (gov-issued: DARPAN ID, 12A number, registration cert number)
  └── proof_file  (PDF/JPG/PNG, max 10 MB — Certificate of Incorporation, 80G, etc.)

Account created with is_active=False (cannot log in yet)
  │
  └── Superadmin opens Admin Panel → "NGO Admin Applications"
        ├── Reviews proof document (link opens in new tab)
        ├── "Approve" → is_active=True, NGO can log in
        └── "Reject" → optional reason stored, account stays inactive
```

Proof files go to Cloudinary if configured, otherwise `backend/uploads/` locally.

---

## Project Structure

```
smart-resource-allocation/
├── .env.example
├── README.md
├── docker-compose.yml
├── render.yaml
├── setup.bat / setup.sh
├── start.bat  / start.sh
│
├── frontend/src/pages/
│   ├── Landing.tsx
│   ├── Login.tsx
│   ├── Register.tsx             user + volunteer registration
│   ├── AdminRegister.tsx        NGO admin application  ← NEW
│   ├── AdminDashboard.tsx       admin stats + needs queue
│   ├── AdminPanel.tsx           user mgmt, NGO approvals, pipeline
│   ├── LiveMap.tsx              admin full map (match + assign)
│   ├── VolunteerMap.tsx         volunteer restricted map  ← NEW
│   ├── VolunteerDashboard.tsx   volunteer tasks + GPS
│   ├── UserDashboard.tsx        community member dashboard  ← NEW
│   └── Chat.tsx
│
└── backend/app/
    ├── models/
    │   └── ngo_registration.py  ← NEW
    └── routes/
        └── admin_register.py    ← NEW  (/api/auth/admin-register, /api/auth/admin-registrations)
```

---

## Testing

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v

# Individual modules
pytest tests/test_priority.py -v
pytest tests/test_geo.py -v
pytest tests/test_routes.py -v
```

Uses in-memory SQLite + mock Redis — no external services required.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `redis.exceptions.ConnectionError` | Start Redis: `redis-server` |
| `flask db upgrade` fails "table exists" | `flask db stamp head && flask db migrate && flask db upgrade` |
| Celery tasks never complete | Ensure worker terminal is open; `REDIS_URL` matches in `.env` |
| Volunteer map shows no pins | Needs must have `lat`/`lng`. Use "My Location" when submitting, or ensure ingestion pipeline geocodes data. |
| Proof upload fails | Without Cloudinary, files go to `backend/uploads/`. Set `CLOUDINARY_*` env vars for production. |
| `spacy E050` (model not found) | `python -m spacy download en_core_web_sm` |
| `user` role redirected to landing after login | Clear `localStorage` and log in again — old tokens may carry a stale redirect target. |
| React changes not showing on Flask `/app` | Run `npm run build` in `frontend/` to regenerate `templates/app.html`. |
