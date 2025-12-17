#!/bin/sh

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
ENV_EXAMPLE_FILE="$COLLABST_DIR/.env.example"
ENV_FILE="$COLLABST_DIR/.env"

cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"

echo "UID=$(id -u)" >> "$ENV_FILE"
echo "GID=$(id -g)" >> "$ENV_FILE"

# Final instructions
echo "Setup complete."
echo "You can now run the 'sh $COLLABST_DIR/scripts/start_dev.sh [options]' to start the development environment."
echo "Replace [options] with any docker-compose up options you wish to pass."
echo "For example, to run in detached mode, use: sh $COLLABST_DIR/scripts/start_dev.sh -d --build"
echo "To stop the development environment, use: sh $COLLABST_DIR/scripts/stop_dev.sh"
echo "Similarly, you can pass options to the stop script as you would with docker-compose down."
