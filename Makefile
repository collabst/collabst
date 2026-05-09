.PHONY: help setup start startd stop restart logs status build clean \
	build-prod start-prod startd-prod stop-prod restart-prod logs-prod status-prod

COMPOSE := docker-compose
CONFIG_DIR := config
COMPOSE_DIR := $(CONFIG_DIR)/compose
ENV_DIR := $(CONFIG_DIR)/env
ENV_FILE := $(ENV_DIR)/.env
DEV_COMPOSE_FILE := $(COMPOSE_DIR)/docker-compose.dev.yml
PROD_COMPOSE_FILE := $(COMPOSE_DIR)/docker-compose.prod.yml
DEV_COMPOSE := $(COMPOSE) --env-file $(ENV_FILE) -f $(DEV_COMPOSE_FILE)
PROD_COMPOSE := $(COMPOSE) --env-file $(ENV_FILE) -f $(PROD_COMPOSE_FILE)

# Default target
help:
	@echo "Collabst Development Commands"
	@echo "=============================="
	@echo ""
	@echo "Setup & Start:"
	@echo "  make setup           - Set up environment (create config/env/.env file)"
	@echo "  make start           - Start development environment"
	@echo "  make startd          - Start development environment in detached mode"
	@echo "  make stop            - Stop development environment"
	@echo "  make restart         - Restart development environment"
	@echo ""
	@echo "Production:"
	@echo "  make build-prod      - Build production backend image"
	@echo "  make start-prod      - Start production environment"
	@echo "  make startd-prod     - Start production environment in detached mode"
	@echo "  make stop-prod       - Stop production environment"
	@echo "  make restart-prod    - Restart production environment"
	@echo "  make logs-prod       - View production logs"
	@echo "  make status-prod     - Check production service status"
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
	@bash ./scripts/setup.dev.sh

# Start development environment
start:
	@echo "Starting Collabst..."
	@$(DEV_COMPOSE) up $(ARGS)

# Detached start
startd:
	@echo "Starting Collabst in detached mode..."
	@$(DEV_COMPOSE) up -d $(ARGS)

# Stop development environment
stop:
	@echo "Stopping Collabst..."
	@$(DEV_COMPOSE) down $(ARGS)

# Restart services
restart:
	@echo "Restarting Collabst..."
ifdef SERVICE
	@$(DEV_COMPOSE) restart $(SERVICE) $(ARGS)
else
	@$(DEV_COMPOSE) restart $(ARGS)
endif

# View logs
logs:
ifdef SERVICE
	@$(DEV_COMPOSE) logs -f $(SERVICE)
else
	@$(DEV_COMPOSE) logs -f
endif

# Check service status
status:
	@$(DEV_COMPOSE) ps

# Build
build:
	@echo "Building and starting Collabst..."
	@$(DEV_COMPOSE) build $(ARGS)

# Clean up
clean:
	@echo "Cleaning up Collabst..."
	@echo "This will remove all containers, networks, images, and volumes associated with Collabst."
	@echo "Are you sure? (y/N)"
	@read ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(DEV_COMPOSE) down --rmi all --volumes --remove-orphans; \
		echo "Cleanup completed."; \
	else \
		echo "Cleanup aborted."; \
	fi

# Build production image
build-prod:
	@echo "Building Collabst production backend image..."
	@$(PROD_COMPOSE) build backend $(ARGS)

# Start production environment
start-prod:
	@echo "Starting Collabst production environment..."
	@$(PROD_COMPOSE) up $(ARGS)

# Detached production start
startd-prod:
	@echo "Starting Collabst production environment in detached mode..."
	@$(PROD_COMPOSE) up -d $(ARGS)

# Stop production environment
stop-prod:
	@echo "Stopping Collabst production environment..."
	@$(PROD_COMPOSE) down $(ARGS)

# Restart production services
restart-prod:
	@echo "Restarting Collabst production environment..."
ifdef SERVICE
	@$(PROD_COMPOSE) restart $(SERVICE) $(ARGS)
else
	@$(PROD_COMPOSE) restart $(ARGS)
endif

# View production logs
logs-prod:
ifdef SERVICE
	@$(PROD_COMPOSE) logs -f $(SERVICE)
else
	@$(PROD_COMPOSE) logs -f
endif

# Check production service status
status-prod:
	@$(PROD_COMPOSE) ps
