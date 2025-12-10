#!/bin/bash

echo "Setting up Typst Collaboration Platform Backend..."

echo "1. Checking if .env file exists..."
if [ ! -f .env ]; then
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo "   Please edit .env and set a secure SECRET_KEY"
    echo "   Generate one with: openssl rand -hex 32"
fi

echo "2. Installing dependencies..."
uv sync

echo "3. Starting infrastructure services (Docker)..."
docker-compose up -d

echo "4. Waiting for services to be ready..."
sleep 5

echo "5. Running database migrations..."
uv run alembic revision --autogenerate -m "Initial migration" || true
uv run alembic upgrade head

echo ""
echo "Setup complete!"
echo ""
echo "To start the application, run:"
echo "  uv run uvicorn main:app --reload"
echo ""
echo "Access:"
echo "  - API: http://localhost:8000"
echo "  - Docs: http://localhost:8000/docs"
echo "  - MinIO Console: http://localhost:9001"
echo ""
