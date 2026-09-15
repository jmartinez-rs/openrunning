#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/atos-dev.service"

mkdir -p "${SERVICE_DIR}"

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=ATOS local development stack
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=${PROJECT_DIR}/scripts/atos-dev-up.sh
ExecStop=/usr/bin/docker compose --project-directory ${PROJECT_DIR} --env-file ${PROJECT_DIR}/.env.dev -f ${PROJECT_DIR}/docker-compose.dev.yml stop
TimeoutStartSec=0
RemainAfterExit=yes

[Install]
WantedBy=default.target
EOF

loginctl enable-linger "${USER}" 2>/dev/null || true
systemctl --user daemon-reload
systemctl --user enable --now atos-dev.service

echo "Installed ${SERVICE_FILE}"
echo "ATOS frontend: http://localhost:15173"
echo "ATOS API:      http://localhost:18000/docs"
