#!/bin/sh
set -e

PORT="${PORT:-8000}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-3}"
GUNICORN_THREADS="${GUNICORN_THREADS:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-90}"

python /app/backend/manage.py migrate --noinput
python /app/backend/manage.py collectstatic --noinput

exec gunicorn \
  --chdir /app/backend \
  SoundWave.wsgi:application \
  --bind 0.0.0.0:${PORT} \
  --workers ${GUNICORN_WORKERS} \
  --threads ${GUNICORN_THREADS} \
  --timeout ${GUNICORN_TIMEOUT} \
  --access-logfile - \
  --error-logfile -
