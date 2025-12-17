# Collabst Setup Guide

This guide will help you set up and run Collabst locally using Docker Compose.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)

You can verify your installation by running:
```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Collabst
```

### 2. Set Up Environment Variables

Create a `.env` file by copying the example file:

```bash
cp .env.example .env
```

Add your user ID and group ID to prevent Docker from creating files as root:
```bash
echo "UID=$(id -u)" >> .env
echo "GID=$(id -g)" >> .env
```

**If you are on MacOS, you can skip this step.**

### 3. Configure Environment Variables (Optional)

Open the `.env` file and customize the settings if needed. The default values should work for local development:

```dotenv
# Port Configuration
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
BACKEND_PORT=8000
FRONTEND_PORT=5137

# Security (⚠️ Change these in production!)
POSTGRES_PASSWORD=postgres
MINIO_ROOT_PASSWORD=minioadmin
SECRET_KEY=your-secret-key-change-this-in-production-use-openssl-rand-hex-32
```

> **⚠️ Important for Production:** 
> - Generate a secure `SECRET_KEY` using: `openssl rand -hex 32`
> - Use strong passwords for `POSTGRES_PASSWORD` and `MINIO_ROOT_PASSWORD`

### 4. Launch the Application

Start all services using Docker Compose:

```bash
docker-compose -f docker-compose.dev.yml --env-file .env up
```

To run in detached mode (background):
```bash
docker-compose -f docker-compose.dev.yml --env-file .env up -d
```

### 5. Access the Application

Once all services are running, you can access:

- **Frontend (Web UI):** http://localhost:5137
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **MinIO Console:** http://localhost:9001 (login with `minioadmin` / `minioadmin`)

## Managing the Application

### View Logs

```bash
# View logs from all services
docker-compose -f docker-compose.dev.yml logs

# View logs from a specific service
docker-compose -f docker-compose.dev.yml logs backend
docker-compose -f docker-compose.dev.yml logs frontend

# Follow logs in real-time
docker-compose -f docker-compose.dev.yml logs -f
```

### Stop the Application

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml stop

# Stop and remove containers
docker-compose -f docker-compose.dev.yml down
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.dev.yml restart

# Restart a specific service
docker-compose -f docker-compose.dev.yml restart backend
```

### Clean Up (Remove All Data)

⚠️ **Warning:** This will delete all data including the database!

```bash
docker-compose -f docker-compose.dev.yml down -v
```

## Troubleshooting

### Port Already in Use

If you encounter port conflicts, edit the `.env` file and change the port numbers:

```dotenv
BACKEND_PORT=8001  # Change from 8000 to 8001
FRONTEND_PORT=5138  # Change from 5137 to 5138
```

Then restart the services.

### Services Not Starting

Check the health of individual services:

```bash
docker-compose -f docker-compose.dev.yml ps
```

If a service is unhealthy, check its logs:

```bash
docker-compose -f docker-compose.dev.yml logs <service-name>
```

### Database Issues

If you encounter database connection issues, try:

1. Ensure PostgreSQL is healthy:
   ```bash
   docker-compose -f docker-compose.dev.yml logs postgres
   ```

2. Reset the database:
   ```bash
   docker-compose -f docker-compose.dev.yml down -v
   docker-compose -f docker-compose.dev.yml up
   ```

### Rebuilding Services

If you've made changes to Dockerfiles or dependencies:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Force rebuild without cache:
```bash
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

## Architecture

The application consists of the following services:

- **PostgreSQL** (port 5432): Main database
- **Redis** (port 6379): Caching and WebSocket coordination
- **MinIO** (ports 9000, 9001): S3-compatible object storage for files
- **Backend** (port 8000): FastAPI application
- **Frontend** (port 5137): SvelteKit web application

All services are orchestrated using Docker Compose and share data through Docker volumes.

## Development

For development, the services are configured with:

- **Hot reload**: Code changes are reflected automatically
- **Volume mounts**: Local code is mounted into containers
- **Health checks**: Ensures services are ready before starting dependent services

## Next Steps

After setting up Collabst:

1. Create an account at http://localhost:5137/register
2. Log in and start creating collaborative Typst projects
3. Explore the API documentation at http://localhost:8000/docs

## Support

For issues and questions, please refer to:
- [README.md](README.md) for project overview
- [Backend Architecture](backend/ARCHITECTURE.md) for technical details
- [GitHub Issues](<repository-issues-url>) for bug reports

---

**Enjoy collaborating with Collabst! 🎉**

