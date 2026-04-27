FROM python:3.11-slim

WORKDIR /app

# System deps (no Tesseract — we use Google Cloud Vision / Gemini API)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    python -m spacy download en_core_web_sm

COPY . .

EXPOSE 5000
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "run:app", "--bind", "0.0.0.0:5000"]
