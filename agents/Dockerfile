# Portable container for the FastAPI + LangGraph pipeline.
# Works as-is on Render, Railway, Fly.io, Cloud Run, or any host that
# runs a Docker image. Honors the platform-provided $PORT (defaults 8000).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source (connectors/, mock_data/, *.py, etc.).
COPY . .

EXPOSE 8000

# Shell form so $PORT expands at runtime.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
