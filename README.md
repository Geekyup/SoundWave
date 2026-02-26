## Running with Docker

This repository is split into:
- `backend/` (Django API)
- `frontend/` (React app built and served by Nginx)

`docker-compose.yml` starts both services:
- `backend`: Gunicorn + Django migrations + collectstatic on startup
- `frontend`: Nginx serving built React SPA

### Requirements
- Docker and Docker Compose
- Optional `.env` in project root for runtime configuration

### Start

```powershell
cd d:\SoundWave
docker compose up --build -d
```

### Endpoints
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/`
- Django admin: `http://localhost:8000/admin/`

### Useful commands

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

## Local backend without Docker

```powershell
cd d:\SoundWave
python backend\manage.py migrate
python backend\manage.py runserver
```
