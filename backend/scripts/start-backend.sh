#!/usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations (idempotent if already at head)
alembic upgrade head

# Start the server
exec fastapi dev app/main.py --host 0.0.0.0 --port 8000
