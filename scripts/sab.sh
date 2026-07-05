#!/usr/bin/env bash
#
# sab.sh — start / stop / restart / status for the SAB app (dev run).
#
#   ./scripts/sab.sh start     build the UI, then run the bridge on :7777 and open the browser
#   ./scripts/sab.sh stop      stop the running bridge
#   ./scripts/sab.sh restart   stop, then start
#   ./scripts/sab.sh status    show whether it's running
#
# The bridge serves the built operator UI from ./public and listens on http://localhost:7777.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PID_FILE="$ROOT/.sab.pid"
LOG_FILE="$ROOT/sab-run.log"
PORT=7777
URL="http://localhost:$PORT"

is_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$URL"          # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" # Linux
  fi
}

start() {
  if is_running; then
    echo "SAB is already running (PID $(cat "$PID_FILE")) → $URL"
    open_browser; exit 0
  fi
  echo "Building operator UI…"
  npm run build:ui
  echo "Starting SAB bridge on $URL …"
  # Run detached; keep logs. npm run dev = tsx src/index.ts (serves ./public on :7777).
  nohup npm run dev > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  # Wait until the port answers (up to ~15s).
  for _ in $(seq 1 30); do
    if curl -s -o /dev/null "$URL" 2>/dev/null; then break; fi
    sleep 0.5
  done
  if is_running; then
    echo "SAB is up (PID $(cat "$PID_FILE")). Logs: $LOG_FILE"
    open_browser
  else
    echo "SAB failed to start — see $LOG_FILE"; exit 1
  fi
}

stop() {
  if is_running; then
    PID="$(cat "$PID_FILE")"
    echo "Stopping SAB (PID $PID)…"
    # Kill the process group so the tsx child exits too.
    kill "$PID" 2>/dev/null || true
    pkill -P "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  else
    echo "SAB is not running. Sweeping any stray bridge on :$PORT…"
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
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  *) echo "usage: $0 {start|stop|restart|status}"; exit 2 ;;
esac
