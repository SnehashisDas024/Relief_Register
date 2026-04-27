#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — One-time local dev setup for Smart Resource Allocation (Mac/Linux)
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#
# After setup, start with:
#   ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "========================================"
echo " Smart Resource Allocation — Setup"
echo "========================================"
echo ""

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.11+ from https://python.org"
    exit 1
fi
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "  Python $PYTHON_VERSION found"

# ── Create venv ───────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Creating virtual environment..."
cd backend
python3 -m venv .venv
source .venv/bin/activate

# ── Install dependencies ──────────────────────────────────────────────────────
echo "[2/5] Installing Python dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt

# ── spaCy model ───────────────────────────────────────────────────────────────
echo "[3/5] Downloading spaCy language model..."
python -m spacy download en_core_web_sm || echo "  WARNING: spaCy model download failed. Keyword fallback will be used."

# ── .env ──────────────────────────────────────────────────────────────────────
echo "[4/5] Setting up environment variables..."
cd ..
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "  IMPORTANT: Open .env and fill in your API keys:"
    echo "    - GEMINI_API_KEY  (free at https://aistudio.google.com)"
    echo "    - CLOUDINARY_URL  (free at https://cloudinary.com)"
    echo "    - TWILIO_*        (optional - for SMS)"
    echo "    - MAIL_*          (optional - for email)"
    echo ""
else
    echo "  .env already exists — skipping."
fi

# ── DB migrations ─────────────────────────────────────────────────────────────
echo "[5/5] Initialising database..."
cd backend
export FLASK_ENV=development
flask db upgrade 2>/dev/null || echo "  No migrations found — tables will be created on first run."

echo ""
echo "========================================"
echo " Setup complete!"
echo "========================================"
echo ""
echo "  Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Start Redis (if not running):"
echo "       docker run -d -p 6379:6379 redis:alpine"
echo "       # OR: brew install redis && brew services start redis (Mac)"
echo "  3. Run:  ./start.sh"
echo ""
