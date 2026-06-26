#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="/Users/otang_server/.openclaw/workspace/projects/rentcar00-booking-system"
LOG_DIR="$PROJECT_ROOT/logs"
LOCK_DIR="/tmp/premove-zzimcar-reconcile.lock"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$STAMP] skip: previous zzimcar reconcile still running" >> "$LOG_DIR/zzimcar-reconcile.log"
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$PROJECT_ROOT"

set -a
source "$PROJECT_ROOT/.env"
set +a

SAVE_FLAG=""
if [[ "${ZZIMCAR_SYNC_SAVE:-false}" == "true" ]]; then
  SAVE_FLAG="--save"
fi

echo "[$STAMP] start zzimcar reconcile save=${ZZIMCAR_SYNC_SAVE:-false}" >> "$LOG_DIR/zzimcar-reconcile.log"
/opt/homebrew/bin/node "$PROJECT_ROOT/scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js" ${=SAVE_FLAG} >> "$LOG_DIR/zzimcar-reconcile.log" 2>> "$LOG_DIR/zzimcar-reconcile-error.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] done zzimcar reconcile" >> "$LOG_DIR/zzimcar-reconcile.log"
