#!/bin/bash

# Get useful paths
SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
COLLABST_DIR="$(dirname "$SCRIPT_DIR")"

# Check for Docker and Docker Compose installation
docker --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Docker is not installed. Please install Docker to proceed."
    exit 1
fi

docker-compose --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Docker Compose is not installed. Please install Docker Compose to proceed."
    exit 1
fi

# Set up environment variables
ENV_EXAMPLE_FILE="$COLLABST_DIR/config/env/.env.dev.example"
ENV_FILE="$COLLABST_DIR/config/env/.env"

if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
    echo "Missing env template at $ENV_EXAMPLE_FILE"
    exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"

cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"

echo "UID=$(id -u)" >> "$ENV_FILE"
echo "GID=$(id -g)" >> "$ENV_FILE"

# Final instructions
echo "Setup complete."
