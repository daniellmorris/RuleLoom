#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run this script" >&2
  exit 1
fi

if command -v docker compose >/dev/null 2>&1; then
  if docker compose watch --help >/dev/null 2>&1; then
    echo "Running 'docker compose watch' so the orchestrator rebuilds when files change..."
    exec docker compose watch
  else
    echo "'docker compose watch' is not available, falling back to 'docker compose up --build'."
    exec docker compose up --build
  fi
elif command -v docker-compose >/dev/null 2>&1; then
  echo "'docker compose' is not available, falling back to legacy 'docker-compose up --build'."
  exec docker-compose up --build
else
  echo "Docker Compose is required (either 'docker compose' or 'docker-compose')." >&2
  exit 1
fi
