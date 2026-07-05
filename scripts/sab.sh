#!/usr/bin/env bash
#
# sab.sh — start / stop / restart / status for the SAB app.
#
#   ./scripts/sab.sh start     build backend + UI, run the production bridge on :7777, open the browser
#   ./scripts/sab.sh stop      stop the running bridge
#   ./scripts/sab.sh restart   stop, then start
#   ./scripts/sab.sh status    show whether it's running
#   ./scripts/sab.sh dev       run in dev mode (tsx, no build) — for development only
#
# start runs exactly what the packaged app runs: node dist/bridge.cjs serving the
# built operator UI from ./public on http://localhost:7777. No global installs needed
# beyond the repo's own node_modules.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PID_FILE="$ROOT/.sab.pid"
LOG_FILE="$ROOT/sab-run.log"
PORT=7777
URL="http://localhost:$PORT"

is_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  fi
}

ensure_deps() {
  [ -d node_modules ] || { echo "Installing backend deps…"; npm install; }
  [ -d frontend/node_modules ] || { echo "Installing UI deps…"; (cd frontend && npm install); }
}

wait_for_port() {
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "$URL" 2>/dev/null; then return 0; fi
    sleep 0.5
  done
  return 1
}

launch() {
  local cmd="$1"                     # "prod" or "dev"
  if is_running; then
    echo "SAB is already running (PID $(cat "$PID_FILE")) → $URL"; open_browser; exit 0
  fi
  ensure_deps
  if [ "$cmd" = "prod" ]; then
    echo "Building backend…"; npm run build
    echo "Building operator UI…"; npm run build:ui
    echo "Starting SAB (production bridge) on $URL …"
    nohup node dist/bridge.cjs > "$LOG_FILE" 2>&1 &
  else
    echo "Starting SAB (dev) on $URL …"
    nohup npm run dev > "$LOG_FILE" 2>&1 &
  fi
  echo $! > "$PID_FILE"
  if wait_for_port; then
    echo "SAB is up (PID $(cat "$PID_FILE")). Logs: $LOG_FILE"; open_browser
  else
    echo "SAB failed to start — see $LOG_FILE"; exit 1
  fi
}

stop() {
  if is_running; then
    PID="$(cat "$PID_FILE")"
    echo "Stopping SAB (PID $PID)…"
    kill "$PID" 2>/dev/null || true
    pkill -P "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  else
    echo "No tracked PID. Sweeping any stray bridge on :$PORT…"
    pkill -f "node dist/bridge.cjs" 2>/dev/null || true
    pkill -f "tsx src/index.ts" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo "Stopped."
}

status() {
  if is_running; then echo "SAB is RUNNING (PID $(cat "$PID_FILE")) → $URL"
  else echo "SAB is stopped."; fi
}

case "${1:-}" in
  start)   launch prod ;;
  dev)     launch dev ;;
  stop)    stop ;;
  restart) stop; launch prod ;;
  status)  status ;;
  *) echo "usage: $0 {start|stop|restart|status|dev}"; exit 2 ;;
esac
