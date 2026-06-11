#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/pi/deflector-control}"
SERVICE_NAME="${SERVICE_NAME:-deflector-control.service}"
SERVICE_SOURCE="${APP_DIR}/systemd/${SERVICE_NAME}"
SERVICE_DEST="/etc/systemd/system/${SERVICE_NAME}"

if [[ ! -f "${SERVICE_SOURCE}" ]]; then
  echo "Missing service file: ${SERVICE_SOURCE}" >&2
  exit 1
fi

chmod +x "${APP_DIR}/scripts/start-pi.sh"

sudo install -m 0644 "${SERVICE_SOURCE}" "${SERVICE_DEST}"
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl --no-pager --lines=20 status "${SERVICE_NAME}"

echo "Deflector Control is installed at http://pizero.local/"
