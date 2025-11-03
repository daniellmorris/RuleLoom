#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run this script" >&2
  exit 1
fi

if command -v docker compose >/dev/null 2>&1; then
  docker compose up --build
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up --build
else
  echo "Docker Compose is required (either 'docker compose' or 'docker-compose')." >&2
  exit 1
fi
