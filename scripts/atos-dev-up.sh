#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env.dev"

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${PROJECT_DIR}/.env.dev.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE}; update local credentials if needed."
fi

docker compose \
  --project-directory "${PROJECT_DIR}" \
  --env-file "${ENV_FILE}" \
  -f "${PROJECT_DIR}/docker-compose.dev.yml" \
  up -d
