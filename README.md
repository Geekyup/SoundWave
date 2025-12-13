# SoundWave

A web application for managing musical sample libraries and loops. Create, organize, and manage your collection of sounds in one place.

## Features

- Upload and organize samples and loops
- Categorize by genres and types
- User account system
- Music library management
- Convenient interface for working with audio

## Quick Start (Docker)

### 1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you don't have it yet

### 2. Clone the repository

```sh
git clone https://github.com/Geekyup/SoundWave.git
cd SoundWave
```

### 3. Build and start the project

```sh
docker compose up --build
```

### 4. Run migrations and collect static files

In a new terminal:

```sh
docker compose exec web python manage.py migrate
docker compose exec web python manage.py collectstatic --noinput
```

### 5. Open the site

Go to [http://localhost:8000/](http://localhost:8000/) in your browser.

---

## Notes

- All uploaded audio files and static files are stored in the `media/` and `staticfiles/` folders (not committed to the repository).
- For local development without Docker, configure environment variables in `.env` (see `.env.example`).
- To create a superuser, run:

```sh
docker compose exec web python manage.py createsuperuser
```



