## Running with Docker

This project includes a Docker setup for local development and deployment. The provided Dockerfile uses Python 3.11-slim, installs dependencies from requirements.txt into a virtual environment, and the Compose service runs Gunicorn bound to port 8000. For local development docker-compose mounts the project into the container so code changes are picked up without rebuilding.

### Requirements
- Docker and Docker Compose installed on your system.
- Recommended: a `.env` file in the project root with at least:
  - DJANGO_SECRET_KEY
  - DEBUG (0 or 1)
  - DJANGO_DB_ENGINE (e.g. sqlite or postgres)
  Compose can load this file if you enable `env_file` in docker-compose.yml.

### Build and start (recommended)
From PowerShell (Windows) or a POSIX shell, run from the project root (d:\SoundWave):

```powershell
cd d:\SoundWave
docker compose up --build -d
```

This will:
- Build the image using the provided `Dockerfile` (Python 3.11-slim)
- Install all dependencies from `requirements.txt`
- Start the Django development server on port **8000**

The app will be available at [http://localhost:8000](http://localhost:8000).

### Configuration
- The container runs as a non-root user for security.
- If you need to set environment variables, create a `.env` file in the project root. Uncomment the `env_file` line in `docker-compose.yml` if you want Docker Compose to load it automatically.
- All application code is copied into the container, excluding files/directories listed in `.dockerignore`.

### Ports
- **8000:8000** – Django development server (container → host)

---

*For more details on environment variables or advanced configuration, refer to the `.env` file in the project root or the `docker-compose.yml` comments.*
