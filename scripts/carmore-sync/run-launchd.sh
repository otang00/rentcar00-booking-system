#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="/Users/otang_server/.openclaw/workspace/projects/rentcar00-booking-system"
LOG_DIR="$PROJECT_ROOT/logs"
LOCK_DIR="/tmp/premove-carmore-reconcile.lock"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$STAMP] skip: previous carmore reconcile still running" >> "$LOG_DIR/carmore-reconcile.log"
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$PROJECT_ROOT"

set -a
source "$PROJECT_ROOT/.env"
set +a

SAVE_FLAG=""
if [[ "${CARMORE_SYNC_SAVE:-false}" == "true" ]]; then
  SAVE_FLAG="--save"
fi

echo "[$STAMP] start carmore reconcile save=${CARMORE_SYNC_SAVE:-false}" >> "$LOG_DIR/carmore-reconcile.log"
/opt/homebrew/bin/node "$PROJECT_ROOT/scripts/carmore-sync/run-carmore-reconcile-sync.js" ${=SAVE_FLAG} >> "$LOG_DIR/carmore-reconcile.log" 2>> "$LOG_DIR/carmore-reconcile-error.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] done carmore reconcile" >> "$LOG_DIR/carmore-reconcile.log"
