#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[fx-bridge] Generating crypto material from config/crypto-config.yaml"
cryptogen generate --config="${ROOT}/config/crypto-config.yaml" --output="${ROOT}/organizations"
echo "[fx-bridge] Crypto generation complete."
