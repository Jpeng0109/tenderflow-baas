#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend" && npm run dev &
sleep 2
cd "$ROOT/console" && npm run dev &
cd "$ROOT/explorer" && npm run dev &
echo "[fx-bridge] Platform UIs starting..."
echo "  Console:  http://localhost:5173"
echo "  Explorer: http://localhost:5174"
echo "  API:      http://localhost:4100"
