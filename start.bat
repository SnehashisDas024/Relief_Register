@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM start.bat — Start the Smart Resource Allocation backend (Windows)
REM
REM Run from repo root:  start.bat
REM Make sure Redis is running first (see setup.bat output).
REM ─────────────────────────────────────────────────────────────────────────────

echo.
echo ========================================
echo  Smart Resource Allocation — Starting
echo ========================================
echo.

cd backend

REM ── Activate venv ────────────────────────────────────────────────────────
if not exist .venv\Scripts\activate.bat (
    echo ERROR: Virtual environment not found. Run setup.bat first.
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat

REM ── Load .env ─────────────────────────────────────────────────────────────
if exist ..\env (
    echo Loading environment from .env...
    for /f "usebackq tokens=1,* delims==" %%A in ("..\env") do (
        if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
    )
)

REM ── Check Redis ────────────────────────────────────────────────────────────
echo Checking Redis connection...
python -c "import redis; r=redis.Redis(); r.ping(); print('  Redis OK')" 2>nul
if errorlevel 1 (
    echo.
    echo  WARNING: Redis is not running on localhost:6379
    echo  Start Redis with:  docker run -d -p 6379:6379 redis:alpine
    echo  Or install Redis for Windows from:
    echo    https://github.com/microsoftarchive/redis/releases
    echo.
    echo  The server will start but file uploads and priority queue
    echo  will not work without Redis.
    echo.
)

REM ── Run DB migrations ─────────────────────────────────────────────────────
set FLASK_ENV=development
flask db upgrade 2>nul

REM ── Start Flask dev server ────────────────────────────────────────────────
echo.
echo  Starting Flask on http://localhost:5000
echo  Press Ctrl+C to stop.
echo.
python run.py

pause
