.PHONY: help setup start stop restart logs clean build rebuild status

# Default target
help:
	@echo "Collabst Development Commands"
	@echo "=============================="
	@echo ""
	@echo "Setup & Start:"
	@echo "  make setup           - Set up environment (create .env file)"
	@echo "  make start           - Start development environment"
	@echo "  make startd          - Start development environment in detached mode"
	@echo "  make stop            - Stop development environment"
	@echo "  make restart         - Restart development environment"
	@echo ""
	@echo "Development:"
	@echo "  make logs            - View logs from all services"
	@echo "  make status          - Check status of all services"
	@echo "  make build           - Build containers"
	@echo "  make clean           - Clean up all containers, images, and volumes"
	@echo ""
	@echo "Options:"
	@echo "  SERVICE=name         - Target specific service (e.g., make logs SERVICE=backend)"
	@echo "  ARGS='...'           - Pass options to docker-compose (e.g., make start ARGS='-d --build')"
	@echo ""
	@echo "Examples:"
	@echo "  make start ARGS='-d'              - Start in detached mode"
	@echo "  make start ARGS='--build'         - Start with rebuild"
	@echo "  make start ARGS='-d --build'      - Start detached with rebuild"
	@echo "  make stop ARGS='-v'               - Stop and remove volumes"

# Setup environment
setup:
	@echo "Setting up Collabst development environment..."
	@sh ./scripts/setup.sh

# Start development environment
start:
	@echo "Starting Collabst..."
	@docker-compose -f docker-compose.dev.yml up $(ARGS)

# Detached start
startd:
	@echo "Starting Collabst in detached mode..."
	@docker-compose -f docker-compose.dev.yml up -d $(ARGS)

# Stop development environment
stop:
	@echo "Stopping Collabst..."
	@docker-compose -f docker-compose.dev.yml down $(ARGS)

# Restart services
restart:
	@echo "Restarting Collabst..."
ifdef SERVICE
	@docker-compose -f docker-compose.dev.yml restart $(SERVICE) $(ARGS)
else
	@docker-compose -f docker-compose.dev.yml restart $(ARGS)
endif

# View logs
logs:
ifdef SERVICE
	@docker-compose -f docker-compose.dev.yml logs -f $(SERVICE)
else
	@docker-compose -f docker-compose.dev.yml logs -f
endif

# Check service status
status:
	@docker-compose -f docker-compose.dev.yml ps

# Build
build:
	@echo "Building and starting Collabst..."
	@docker-compose -f docker-compose.dev.yml build $(ARGS)

# Clean up
clean:
	@echo "Cleaning up Collabst..."
	@echo "This will remove all containers, networks, images, and volumes associated with Collabst."
	@echo "Are you sure? (y/N)"
	@read ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		docker-compose -f docker-compose.dev.yml down --rmi all --volumes --remove-orphans; \
		echo "Cleanup completed."; \
	else \
		echo "Cleanup aborted."; \
	fi
