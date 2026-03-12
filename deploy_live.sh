#!/bin/bash
set -euo pipefail

REPO="/home/admin1/Downloads/rbhargava-invoice-generator"
FRONTEND="$REPO/client"
LIVE="/var/www/invoice-app"
BACKEND_PROCESS="invoice-backend"

usage() {
  echo "Usage: $0 {full|frontend|backend}"
  echo
  echo "  full      Build frontend, sync build to nginx live dir, restart backend"
  echo "  frontend  Build frontend and sync build to nginx live dir"
  echo "  backend   Restart backend only"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: required command not found: $1" >&2
    exit 1
  }
}

build_frontend() {
  echo "[INFO] Building frontend..."
  cd "$FRONTEND"
  npm run build

  echo "[INFO] Syncing frontend build to $LIVE ..."
  sudo rsync -av --delete "$FRONTEND/build/" "$LIVE/"
}

restart_backend() {
  echo "[INFO] Restarting backend PM2 process: $BACKEND_PROCESS ..."
  cd "$REPO"
  pm2 restart "$BACKEND_PROCESS"
}

post_checks() {
  echo "[INFO] Checking services..."
  pm2 status
  sudo systemctl --no-pager --full status nginx | sed -n '1,8p'
  sudo systemctl --no-pager --full status cloudflared | sed -n '1,8p'
  echo "[INFO] Live URL: https://invoice.invoicecreation.store"
}

main() {
  require_cmd npm
  require_cmd pm2
  require_cmd rsync

  if [ "$#" -ne 1 ]; then
    usage
    exit 1
  fi

  case "$1" in
    full)
      build_frontend
      restart_backend
      post_checks
      echo "[OK] Full deploy completed."
      ;;
    frontend)
      build_frontend
      post_checks
      echo "[OK] Frontend deploy completed."
      ;;
    backend)
      restart_backend
      post_checks
      echo "[OK] Backend deploy completed."
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "Error: unknown option '$1'" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
