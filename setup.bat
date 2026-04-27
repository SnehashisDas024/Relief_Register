@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM setup.bat — One-time local dev setup for Smart Resource Allocation (Windows)
REM
REM Run this ONCE from the repo root:
REM   setup.bat
REM
REM Then every time you want to start the server:
REM   start.bat
REM ─────────────────────────────────────────────────────────────────────────────

echo.
echo ========================================
echo  Smart Resource Allocation — Setup
echo ========================================
echo.

REM ── Check Python version ──────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.11+ from https://python.org
    pause
    exit /b 1
)

REM ── Create virtual environment ────────────────────────────────────────────
echo [1/5] Creating virtual environment...
cd backend
python -m venv .venv
if errorlevel 1 ( echo ERROR: venv creation failed & pause & exit /b 1 )

REM ── Activate and install dependencies ────────────────────────────────────
echo [2/5] Installing Python dependencies (this may take 2-3 minutes)...
call .venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 ( echo ERROR: pip install failed & pause & exit /b 1 )

REM ── Download spaCy model ──────────────────────────────────────────────────
echo [3/5] Downloading spaCy language model...
python -m spacy download en_core_web_sm
if errorlevel 1 ( echo WARNING: spaCy model download failed. Classification will use keyword fallback. )

REM ── Create .env from template ─────────────────────────────────────────────
echo [4/5] Setting up environment variables...
cd ..
if not exist .env (
    copy .env.example .env
    echo.
    echo  IMPORTANT: Open .env and fill in your API keys:
    echo    - GEMINI_API_KEY  (get free at https://aistudio.google.com^)
    echo    - CLOUDINARY_URL  (get free at https://cloudinary.com^)
    echo    - TWILIO_*        (optional - for SMS)
    echo    - MAIL_*          (optional - for email)
    echo.
) else (
    echo  .env already exists — skipping.
)

REM ── Run DB migrations ─────────────────────────────────────────────────────
echo [5/5] Initialising database...
cd backend
call .venv\Scripts\activate.bat
set FLASK_ENV=development
flask db upgrade 2>nul
if errorlevel 1 (
    echo  No migrations found — tables will be created on first run.
)

echo.
echo ========================================
echo  Setup complete!
echo ========================================
echo.
echo  Next steps:
echo  1. Edit .env with your API keys (at repo root)
echo  2. Make sure Redis is running:
echo       Option A: Docker:  docker run -d -p 6379:6379 redis:alpine
echo       Option B: Download from https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/install-redis-on-windows/
echo  3. Run:  start.bat
echo.
pause
