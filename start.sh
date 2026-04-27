#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Start the Smart Resource Allocation backend (Mac/Linux)
#
# Usage (from repo root):
#   ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/backend"

# ── Activate venv ─────────────────────────────────────────────────────────────
if [ ! -f .venv/bin/activate ]; then
    echo "ERROR: Virtual environment not found. Run ./setup.sh first."
    exit 1
fi
source .venv/bin/activate

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ -f ../.env ]; then
    set -a
    # shellcheck disable=SC1091
    source ../.env
    set +a
fi

export FLASK_ENV="${FLASK_ENV:-development}"

# ── Check Redis ────────────────────────────────────────────────────────────────
if ! python -c "import redis; redis.Redis().ping()" &>/dev/null; then
    echo ""
    echo "  WARNING: Redis is not running on localhost:6379"
    echo "  Start with:  docker run -d -p 6379:6379 redis:alpine"
    echo "  Or (Mac):    brew services start redis"
    echo ""
fi

# ── DB migrations ─────────────────────────────────────────────────────────────
flask db upgrade 2>/dev/null || true

# ── Start Flask ───────────────────────────────────────────────────────────────
echo ""
echo "  Starting Flask on http://localhost:5000"
echo "  Press Ctrl+C to stop."
echo ""
python run.py
