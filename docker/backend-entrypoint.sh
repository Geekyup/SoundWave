#!/bin/sh
set -e

python /app/backend/manage.py migrate --noinput
python /app/backend/manage.py collectstatic --noinput

exec gunicorn \
  --chdir /app/backend \
  SoundWave.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --threads 2 \
  --timeout 90 \
  --access-logfile - \
  --error-logfile -
