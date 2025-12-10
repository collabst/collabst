# Quick Start Guide

Get your Typst Collaboration Platform backend running in 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- **Python 3.12+** installed
- **Docker Desktop** running
- **uv** package manager ([install guide](https://github.com/astral-sh/uv))

## Step 1: Clone and Navigate

```bash
cd /path/to/collabst/backend
```

## Step 2: Install Dependencies

```bash
uv sync
```

This installs all required Python packages:
- FastAPI & Uvicorn
- SQLAlchemy & Alembic
- Redis & MinIO clients
- YJS (y-py) for collaboration
- Authentication libraries

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Generate a secure secret key:

```bash
openssl rand -hex 32
```

Edit `.env` and replace the `SECRET_KEY` value with your generated key.

## Step 4: Start Infrastructure

```bash
docker-compose up -d
```

This starts three services:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **MinIO** on ports 9000 (API) and 9001 (Console)

Verify services are running:

```bash
docker-compose ps
```

You should see all three containers with status "Up".

## Step 5: Initialize Database

Create the initial database schema:

```bash
uv run alembic revision --autogenerate -m "Initial migration"
uv run alembic upgrade head
```

Or use the helper script:

```bash
./scripts/migrate.sh "Initial migration"
```

## Step 6: Start the Application

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or use the dev script:

```bash
./scripts/dev.sh
```

## Step 7: Verify It's Working

### Access the API Documentation

Open your browser and visit:
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

### Test the Health Endpoint

```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "message": "Typst Collaboration Platform API",
  "version": "0.1.0"
}
```

### Access MinIO Console

Visit http://localhost:9001 and login with:
- **Username**: `minioadmin`
- **Password**: `minioadmin`

## Your First API Request

### 1. Register a User

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "securepassword123"
  }'
```

### 2. Login

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d 'email=user@example.com&password=securepassword123'
```

Save the `access_token` from the response.

### 3. Create a Project

```bash
curl -X POST "http://localhost:8000/api/v1/projects" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Project",
    "description": "A test Typst project"
  }'
```

### 4. Create a File (Text File - Stored in PostgreSQL)

```bash
curl -X POST "http://localhost:8000/api/v1/projects/1/files" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "main.typ",
    "path": "/main.typ",
    "type": "typst",
    "content": "#heading[Hello World]\\n\\nThis is my first Typst document."
  }'
```

### 5. Upload an Asset (Binary File - Stored in MinIO)

Upload an image, PDF, or any binary file to test MinIO object storage:

```bash
# Create a test image first
echo "Test image content" > test-image.png

# Upload it
curl -X POST "http://localhost:8000/api/v1/projects/1/assets/upload" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@test-image.png"
```

Expected response:
```json
{
  "filename": "test-image.png",
  "mime_type": "image/png",
  "id": 1,
  "project_id": 1,
  "storage_path": "projects/1/assets/test-image.png",
  "size": 18,
  "created_at": "2025-12-10T22:30:00.000000",
  "updated_at": "2025-12-10T22:30:00.000000"
}
```

### 6. List All Assets in a Project

```bash
curl -X GET "http://localhost:8000/api/v1/projects/1/assets" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 7. Verify in MinIO Console

1. Open http://localhost:9001 (or your MinIO URL)
2. Login with `minioadmin` / `minioadmin`
3. Navigate to the `collabst` bucket
4. You should see: `projects/1/assets/test-image.png`

## Test Real-Time Collaboration

You can test the WebSocket server with a simple Python client:

```python
import asyncio
import websockets

async def test_collaboration():
    uri = "ws://localhost:8000/ws/document-123"
    async with websockets.connect(uri) as websocket:
        # Send a test message
        await websocket.send(b"test update")

        # Receive messages
        response = await websocket.recv()
        print(f"Received: {response}")

asyncio.run(test_collaboration())
```

## Troubleshooting

### Docker Connection Error

**Error**: `Cannot connect to the Docker daemon`

**Solution**: Start Docker Desktop and wait for it to fully initialize.

### Port Already in Use

**Error**: `Address already in use`

**Solution**: Stop the conflicting service or change the port in `docker-compose.yml`.

### Database Connection Failed

**Error**: `Could not connect to database`

**Solution**:
1. Ensure PostgreSQL is running: `docker-compose ps`
2. Check logs: `docker-compose logs postgres`
3. Verify `DATABASE_URL` in `.env`

### Import Errors

**Error**: `ModuleNotFoundError`

**Solution**: Reinstall dependencies:
```bash
uv sync --reinstall
```

## Next Steps

Now that your backend is running:

1. **Explore the API**: Visit http://localhost:8000/docs and try the interactive endpoints
2. **Read the Architecture**: Check out `ARCHITECTURE.md` for design details
3. **Build a Frontend**: Connect your React/Vue/Svelte app to the API
4. **Add Features**: Implement Typst compilation, versioning, or sharing

## Development Workflow

### Making Database Changes

1. Edit models in `app/models/`
2. Generate migration:
   ```bash
   uv run alembic revision --autogenerate -m "Add new field"
   ```
3. Apply migration:
   ```bash
   uv run alembic upgrade head
   ```

### Adding New Endpoints

1. Create/edit router in `app/api/`
2. Add router to `main.py`:
   ```python
   app.include_router(your_router, prefix="/api/v1/your_path")
   ```
3. Test at http://localhost:8000/docs

### Viewing Logs

```bash
# Application logs
uv run uvicorn main:app --log-level debug

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis

# MinIO logs
docker-compose logs -f minio
```

## Production Checklist

Before deploying to production:

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Use managed PostgreSQL (not Docker)
- [ ] Use managed Redis (not Docker)
- [ ] Use AWS S3 or production MinIO cluster
- [ ] Enable HTTPS/TLS
- [ ] Set up proper logging
- [ ] Configure rate limiting
- [ ] Add monitoring (Prometheus, Datadog, etc.)
- [ ] Set up backups
- [ ] Review CORS settings
- [ ] Use environment-specific configs

## Support

- **Documentation**: See `README.md` and `ARCHITECTURE.md`
- **Issues**: Open an issue on GitHub
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Typst Docs**: https://typst.app/docs

## Success!

You now have a fully functional backend for collaborative Typst editing. Happy coding!
