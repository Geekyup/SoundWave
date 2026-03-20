#!/bin/sh
set -e

PORT="${PORT:-8000}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-3}"
GUNICORN_THREADS="${GUNICORN_THREADS:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-90}"

python /app/backend/manage.py migrate --noinput
python /app/backend/manage.py collectstatic --noinput

if [ "${CREATE_SUPERUSER_ON_START:-0}" = "1" ]; then
python /app/backend/manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

username = os.getenv("DJANGO_SUPERUSER_USERNAME", "").strip()
password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "").strip()
email = os.getenv("DJANGO_SUPERUSER_EMAIL", "").strip()

if not username or not password:
    print("Skipping superuser bootstrap: DJANGO_SUPERUSER_USERNAME or DJANGO_SUPERUSER_PASSWORD is missing.")
    raise SystemExit(0)

User = get_user_model()
user, created = User.objects.get_or_create(username=username, defaults={"email": email})

if email:
    user.email = email

user.is_staff = True
user.is_superuser = True
user.set_password(password)
user.save()

print(f"Superuser ready: {username} ({'created' if created else 'updated'})")
PY
fi

exec gunicorn \
  --chdir /app/backend \
  SoundWave.wsgi:application \
  --bind 0.0.0.0:${PORT} \
  --workers ${GUNICORN_WORKERS} \
  --threads ${GUNICORN_THREADS} \
  --timeout ${GUNICORN_TIMEOUT} \
  --access-logfile - \
  --error-logfile -
