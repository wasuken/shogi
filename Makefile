# Makefile for the Shogi AI Project

.PHONY: help up down logs install build battle

# --- Configuration ---
# Default values for the battle command
C1 := minimax
C2 := alphazero
ROUNDS := 5
# List of all node projects
PROJECTS := server client battle-runner

# --- Help ---
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  up        - Start all services in the background using Docker Compose."
	@echo "  down      - Stop all services managed by Docker Compose."
	@echo "  logs      - Tail the logs of all running services."
	@echo "  install   - Install npm dependencies for all projects."
	@echo "  build     - Build all TypeScript projects."
	@echo "  battle    - Run a battle between two AI clients."
	@echo "            - Example: make battle C1=minimax C2=mcts ROUNDS=10"
	@echo ""

dev:
	docker compose -f compose.yml -f compose.dev.yml up

prod:
	docker compose -f compose.yml -f compose.prod.yml up -d

down:
	@echo "Stopping services..."
	docker-compose down

logs:
	@echo "Tailing logs..."
	docker-compose logs -f

# --- Project Setup ---
install:
	@for project in $(PROJECTS); do \
		echo "--- Installing dependencies for $$project ---"; \
		(cd $$project && npm install); \
	done
	@echo "All dependencies installed."

build:
	@for project in $(PROJECTS); do \
		echo "--- Building $$project ---"; \
		(cd $$project && npm run build); \
	done
	@echo "All projects built."

# --- Battle Execution ---
battle:
	@echo "Starting battle: $(C1) vs $(C2) for $(ROUNDS) rounds..."
	@cd battle-runner && npm run battle -- --client1 $(C1) --client2 $(C2) --rounds $(ROUNDS)

clean:
	@echo "Cleaning up build artifacts..."
	@for project in $(PROJECTS); do \
		(cd $$project && rm -rf dist); \
	done
	@echo "Cleanup complete."

.DEFAULT_GOAL := help
