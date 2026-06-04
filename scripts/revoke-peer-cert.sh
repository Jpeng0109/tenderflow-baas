#!/usr/bin/env bash
FQDN="${1:?peer fqdn}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="${ROOT}/organizations/revoked/${FQDN}.revoked"
mkdir -p "$(dirname "$MARKER")"
date -Iseconds > "$MARKER"
echo "[fx-bridge] Marked certificate revocation for ${FQDN}"
