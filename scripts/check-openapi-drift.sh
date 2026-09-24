#! /usr/bin/env bash
set -euo pipefail

# Falla si frontend/openapi.json o frontend/src/client se desincronizan del backend.
# Uso: ./scripts/check-openapi-drift.sh  (CI / pre-push)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

./scripts/generate-client.sh

if ! git diff --quiet -- frontend/openapi.json frontend/src/client; then
  echo ""
  echo "ERROR: openapi.json y/o el cliente están desincronizados con el backend."
  echo "Corré ./scripts/generate-client.sh y commiteá los cambios resultantes."
  echo ""
  git --no-pager diff --stat -- frontend/openapi.json frontend/src/client
  exit 1
fi

echo "OK: openapi.json y el cliente están sincronizados con el backend."
