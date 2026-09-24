#! /usr/bin/env bash
set -euo pipefail

# Regenera openapi.json desde el backend y el cliente tipado del frontend.
# Correr desde la raíz del repo (o desde cualquier lado: el script se ubica solo).
#
# El backend requiere estas variables para importar la app (no se contacta la DB
# para generar el esquema). Si existe un .env en la raíz, se usa; si no, se usan
# valores descartables.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "No hay .env; uso valores descartables solo para generar el esquema."
  export PROJECT_NAME="${PROJECT_NAME:-OpenRunning}"
  export ENVIRONMENT="${ENVIRONMENT:-local}"
  export SECRET_KEY="${SECRET_KEY:-openapi-generation-secret-key-32chars}"
  export POSTGRES_SERVER="${POSTGRES_SERVER:-localhost}"
  export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  export POSTGRES_DB="${POSTGRES_DB:-openrunning_db}"
  export POSTGRES_USER="${POSTGRES_USER:-openrunning}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-openrunning_dev_password}"
  export FIRST_SUPERUSER="${FIRST_SUPERUSER:-admin@example.com}"
  export FIRST_SUPERUSER_PASSWORD="${FIRST_SUPERUSER_PASSWORD:-changethis}"
fi

cd backend
uv run python -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > ../openapi.json
cd ..

mv openapi.json frontend/
cd frontend
bun run generate-client
