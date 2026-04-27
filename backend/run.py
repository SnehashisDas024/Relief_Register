"""
backend/run.py — Local development server entry point.

Production (Render) uses Procfile:
    gunicorn --worker-class eventlet -w 1 run:app

Local dev:
    cd backend
    python run.py
"""
import os
import sys
import eventlet
eventlet.monkey_patch()

# Put backend/ on sys.path so `from app.X` resolves
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True)
