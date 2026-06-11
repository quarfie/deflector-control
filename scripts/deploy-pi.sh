#!/usr/bin/env bash
set -euo pipefail

PI_TARGET="${PI_TARGET:-pi@pizero.local}"
PI_APP_DIR="${PI_APP_DIR:-/home/pi/deflector-control}"
SERVICE_NAME="${SERVICE_NAME:-deflector-control.service}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_CONTROL_PATH="${SSH_CONTROL_PATH:-/tmp/deflector-control-pi-%C}"
SSH_OPTS=(
  -o ControlMaster=auto
  -o ControlPersist=120
  -o "ControlPath=${SSH_CONTROL_PATH}"
)
RSYNC_SSH="ssh -o ControlMaster=auto -o ControlPersist=120 -o ControlPath=${SSH_CONTROL_PATH}"

cleanup() {
  ssh "${SSH_OPTS[@]}" -O exit "${PI_TARGET}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Deploying Deflector Control to ${PI_TARGET}:${PI_APP_DIR}"

echo "Running local tests and building the client..."
cd "${ROOT_DIR}"
npm test
npm run build

ssh "${SSH_OPTS[@]}" "${PI_TARGET}" "mkdir -p '${PI_APP_DIR}'"

rsync -az --delete \
  -e "${RSYNC_SSH}" \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  --exclude 'node_modules/' \
  --exclude 'npm-debug.log*' \
  "${ROOT_DIR}/" "${PI_TARGET}:${PI_APP_DIR}/"

ssh "${SSH_OPTS[@]}" "${PI_TARGET}" "cd '${PI_APP_DIR}' && \
  chmod +x scripts/start-pi.sh scripts/install-pi-service.sh && \
  npm ci --omit=dev && \
  npm test && \
  if systemctl cat '${SERVICE_NAME}' >/dev/null 2>&1; then \
    sudo systemctl daemon-reload && \
    sudo systemctl restart '${SERVICE_NAME}' && \
    sudo systemctl --no-pager --lines=20 status '${SERVICE_NAME}'; \
  else \
    echo 'Service is not installed yet. Run: ssh ${PI_TARGET} \"cd ${PI_APP_DIR} && scripts/install-pi-service.sh\"'; \
  fi"

echo "Deploy complete."
