# SoundWave

SoundWave is a full-stack platform for publishing and browsing audio `loops` and `samples`.

- Backend: `Django + Django REST Framework`
- Frontend: `React + Vite`
- Auth: `JWT` (`djangorestframework-simplejwt`)
- Infra: `Docker Compose` (`Gunicorn` + `Nginx`)

## Project Structure

```text
backend/     Django project and apps
frontend/    React SPA
docker/      container entrypoint scripts
```

## Quick Start (Docker)

Requirements:
- Docker Desktop
- Docker Compose

Run:

```powershell
docker compose up --build -d
```

Endpoints:
- Frontend: `http://localhost:5173`
- API: `http://localhost:8000/api/`
- Django Admin: `http://localhost:8000/admin/`

Useful commands:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

## Local Development (Without Docker)

Backend:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python backend\manage.py migrate
python backend\manage.py runserver
```

Frontend:

```powershell
cd frontend
npm ci
npm run dev
```

## Environment Variables

The project uses a root `.env` file.

Minimal example:

```env
DEBUG=1
DJANGO_SECRET_KEY=change-me
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_URL=http://localhost:8000
```

## API Authentication (JWT)

- `POST /api/auth/register/`
- `POST /api/auth/token/`
- `POST /api/auth/refresh/`
- `GET /api/me/` with header `Authorization: Bearer <access_token>`
