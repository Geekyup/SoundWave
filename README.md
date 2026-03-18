# SoundWave

SoundWave is a full‑stack platform for publishing, browsing, and organizing audio **loops**, **samples**, and **drum kits**.

**Demo:** https://soundwave-production-d3a5.up.railway.app

## What You Can Do
- Upload and browse loops and samples with genre and BPM metadata.
- Auto‑extract BPM from filenames during bulk upload (admin).
- Generate lightweight preview audio for fast playback (ffmpeg).
- Render waveforms and cache peaks for responsive cards.
- Upload drum kits and browse their folder structure with per‑file playback.
- Search, filter, and paginate content.
- Manage uploads from the Django admin (bulk upload included).

## Architecture

Frontend (React + Vite)
→ REST API (Django + DRF)
→ PostgreSQL
→ Media storage (Cloudinary or local media)

Notes
- Waveforms are stored in the database; previews are generated server‑side.
- In production, static assets are served via WhiteNoise.

## Tech Stack
**Backend**
- Python, Django, Django REST Framework
- Django Filters, SimpleJWT
- PostgreSQL
- ffmpeg (audio previews)

**Frontend**
- React, Vite

**Storage**
- Cloudinary (optional, recommended for production)
- Local media storage for dev

## Project Structure
```text
backend/     Django project and apps
frontend/    React SPA
docker/      container entrypoint scripts
```

## Quick Start (Local)

Requirements
- Python 3.11+ (recommended)
- Node.js 18+
- PostgreSQL
- ffmpeg (optional, for preview generation)

Backend
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python backend\manage.py migrate
python backend\manage.py runserver
```

Frontend
```powershell
cd frontend
npm ci
npm run dev
```

App URLs
- Frontend: http://localhost:5173
- API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/

## Quick Start (Docker)
```powershell
docker compose up --build -d
```

## Environment Variables (.env)
Create a `.env` in the project root. Example:

```env
# Core
DEBUG=1
DJANGO_SECRET_KEY=change-me
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://soundwave_user:12345@127.0.0.1:5432/soundwave

# CORS / CSRF
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Frontend API base (used by Vite)
VITE_API_URL=http://localhost:8000

# Media storage
USE_CLOUDINARY=0
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Admin User
```powershell
python backend\manage.py createsuperuser
```

## API Auth (JWT)
- `POST /api/auth/register/`
- `POST /api/auth/token/`
- `POST /api/auth/refresh/`
- `GET /api/me/` with header `Authorization: Bearer <access_token>`

## Deployment Notes
- Set `DEBUG=0`.
- Provide a production `DJANGO_SECRET_KEY`.
- If using Cloudinary, set `USE_CLOUDINARY=1` and the Cloudinary credentials.
