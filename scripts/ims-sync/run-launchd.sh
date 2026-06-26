#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="/Users/otang_server/.openclaw/workspace/projects/rentcar00-booking-system"
LOG_DIR="$PROJECT_ROOT/logs"
LOCK_DIR="/tmp/premove-ims-sync.lock"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$STAMP] skip: previous ims sync still running" >> "$LOG_DIR/ims-sync.log"
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$PROJECT_ROOT"

set -a
source "$PROJECT_ROOT/.env"
set +a

echo "[$STAMP] start ims sync" >> "$LOG_DIR/ims-sync.log"
/opt/homebrew/bin/node "$PROJECT_ROOT/scripts/ims-sync/run-ims-reservation-sync.js" >> "$LOG_DIR/ims-sync.log" 2>> "$LOG_DIR/ims-sync-error.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] done ims sync" >> "$LOG_DIR/ims-sync.log"
