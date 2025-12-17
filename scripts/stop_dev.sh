#!/bin/sh

# Get useful paths
SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
COLLABST_DIR="$(dirname "$SCRIPT_DIR")"

# Stop the development environment
docker-compose -f "$COLLABST_DIR/docker-compose.dev.yml" down $@
