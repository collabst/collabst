#!/bin/bash
set -e

echo "Running database migrations..."
uv run alembic upgrade head

echo "Starting production application..."
exec uv run uvicorn main_prod:app --host 0.0.0.0 --port 8000 --reload
