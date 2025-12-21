# syntax=docker/dockerfile:1

FROM python:3.11-slim AS base

# Builder stage: install dependencies in a venv
FROM base AS builder
WORKDIR /app

# Install system dependencies required for pip packages (e.g., psycopg2, Pillow, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        gcc \
        libffi-dev \
        libssl-dev \
        libjpeg-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv .venv

# Install Python dependencies using pip with cache mount
COPY --link requirements.txt ./
ENV PIP_CACHE_DIR=/root/.cache/pip
RUN --mount=type=cache,target=$PIP_CACHE_DIR \
    .venv/bin/pip install --upgrade pip && \
    .venv/bin/pip install -r requirements.txt

# Final stage: copy app code and venv, set up non-root user
FROM base AS final
WORKDIR /app

# Create non-root user and group
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code (excluding .env, .git, etc. via .dockerignore)
COPY --link . .

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set permissions
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port (Django default is 8000)
EXPOSE 8000

# Entrypoint: run Django app via manage.py (can be overridden in docker-compose)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
