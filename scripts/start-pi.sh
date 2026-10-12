#!/usr/bin/env bash
set -euo pipefail

cd /home/pi/deflector-control

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-80}"
export HOST="${HOST:-0.0.0.0}"
export DMX_OUTPUT="${DMX_OUTPUT:-dry-run}"

exec npm start
