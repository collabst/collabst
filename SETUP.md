# Collabst Setup Guide

This guide covers both **self-hosting** (running your own instance) and **local development**.

---

## Self-Hosting (Production)

### Prerequisites

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- A server with a domain name pointing to it

### 1. Download the required files

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/collabst/collabst/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/collabst/collabst/main/.env.example
```

### 2. Configure your environment

```bash
nano .env
```

Required values to set:
- `WEB_URL` — your public URL (e.g. `https://collabst.yourdomain.com`)
- `MINIO_URL` — storage URL (e.g. `storage.yourdomain.com`)
- `CORS_ORIGINS` — same as `WEB_URL`
- `POSTGRES_PASSWORD` — strong password
- `MINIO_ROOT_PASSWORD` — strong password
- `SECRET_KEY` — generate with `openssl rand -hex 32`

### 3. Start

```bash
docker compose up -d
```

### Updating to a new version

```bash
docker compose pull
docker compose up -d
```

### Managing the instance

```bash
docker compose logs -f          # View logs
docker compose logs -f backend  # Backend logs only
docker compose down             # Stop
docker compose down -v          # Stop and delete all data
```

---

## Local Development

This guide will help you set up and run Collabst locally using the Makefile and Docker Compose.

## Quick Start

Use the Makefile for all setup and management tasks:

```bash
make setup      # Set up environment (.env file)
make start      # Start all services
make startd     # Start in detached mode
make help       # View all available commands
```

For more detailed instructions or manual setup, continue reading below.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)

You can verify your installation by running:
```bash
docker --version
docker-compose --version
```

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd collabst
```

### 2. Set Up Environment

**Using Makefile (Recommended):**
```bash
make setup
```

**If you are on MacOS, do manually create the `.env` file without UID/GID as shown below.**

**Or manually:**

Create a `.env` file by copying the example file:

```bash
cp .env.example .env
```

Add your user ID and group ID to prevent Docker from creating files as root:
```bash
echo "UID=$(id -u)" >> .env
echo "GID=$(id -g)" >> .env
```

For advanced users: you can still use `docker-compose -f docker-compose.dev.yml` directly if needed, but this guide will only reference the Makefile commands for simplicity.

### 3. Configure Environment Variables (Optional)

Open the `.env` file and customize the settings if needed. The default values should work for local development.

> **⚠️ Important for Production:** 
> - Generate a secure `SECRET_KEY` using: `openssl rand -hex 32`
> - Use strong passwords for `POSTGRES_PASSWORD` and `MINIO_ROOT_PASSWORD`

### 4. Launch the Application

```bash
make start                 # Start in interactive mode (see logs)
make startd                # Start in detached mode (background)
make build                 # Build or rebuild services
```

### 5. Access the Application

Once running, access:

- **Frontend (Web UI):** http://localhost:5137
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **MinIO Console:** http://localhost:9001 (login with `minioadmin` / `minioadmin`)


## Managing the Application

### Logs
```bash
make logs                  # All services
make logs SERVICE=backend  # Specific service
```

### Stop
```bash
make stop                # Stop and remove containers
make stop ARGS='-v'      # Remove volumes too
```

### Restart
```bash
make restart             # Restart all services
make restart SERVICE=backend  # Restart one service
```

### Status
```bash
make status              # Show status of all services
```

### Clean Up (Remove All Data)
⚠️ **Warning:** This deletes all data including the database!
```bash
make clean
```

## Troubleshooting

### Port Already in Use
Edit `.env` and change the port numbers, then restart:
```dotenv
BACKEND_PORT=8001
FRONTEND_PORT=5138
```

### Services Not Starting
Check status and logs:
```bash
make status
make logs SERVICE=<service-name>
```

### Database Issues
Try restarting with volume removal:
```bash
make stop ARGS='-v'
make start
```

### Rebuilding Services
If you change Dockerfiles or dependencies:
```bash
make build           # Rebuild
make build ARGS='-d' # Rebuild in detached mode
make rebuild         # Force rebuild without cache
```


## Architecture

Services:
- **PostgreSQL**: Main database
- **Redis**: Caching and WebSocket coordination
- **MinIO**: S3-compatible object storage
- **Backend**: FastAPI app
- **Frontend**: SvelteKit app

All services are managed with Docker Compose and share data via Docker volumes.


## Development

- **Hot reload**: Code changes are reflected automatically
- **Volume mounts**: Local code is mounted into containers
- **Health checks**: Ensures services are ready before starting dependent services


## Next Steps

1. Register: http://localhost:5137/register
2. Log in and create collaborative Typst projects
3. Explore API docs: http://localhost:8000/docs


## Support

See:
- [README.md](README.md) for project overview
- [Backend Architecture](backend/ARCHITECTURE.md) for technical details
- GitHub Issues for bug reports

---

**Enjoy collaborating with Collabst! 🎉**

