#!/usr/bin/env bash
# Double-click to launch SAB. Shows a tiny menu: start / stop / restart / status.
cd "$(dirname "$0")"
echo "──────────── SAB launcher ────────────"
echo "  1) Start   2) Stop   3) Restart   4) Status   5) Dev mode   6) Quit"
read -r -p "Choose [1-6]: " choice
case "$choice" in
  1) ./scripts/sab.sh start ;;
  2) ./scripts/sab.sh stop ;;
  3) ./scripts/sab.sh restart ;;
  4) ./scripts/sab.sh status ;;
  5) ./scripts/sab.sh dev ;;
  *) echo "Bye." ;;
esac
echo
read -r -p "Press Enter to close…" _
