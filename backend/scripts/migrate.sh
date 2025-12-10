#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./scripts/migrate.sh 'Migration message'"
    exit 1
fi

echo "Creating new migration: $1"
uv run alembic revision --autogenerate -m "$1"

echo "Applying migration..."
uv run alembic upgrade head

echo "Migration complete!"
