#!/bin/bash
set -e

echo "Installing dependencies..."
uv sync --frozen

echo "Running database migrations..."
uv run alembic upgrade head

echo "Starting application..."
exec uv run uvicorn main:app --host 0.0.0.0 --port 8000
