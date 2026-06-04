#!/usr/bin/env bash
set -euo pipefail
ORG="${1:?org domain}"
INDEX="${2:?peer index}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/organizations/peerOrganizations/${ORG}/peers/peer0.${ORG}"
DEST="${ROOT}/organizations/peerOrganizations/${ORG}/peers/peer${INDEX}.${ORG}"

if [[ ! -d "$SRC" ]]; then
  echo "Source peer crypto missing. Run generate-crypto.sh first." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp -r "$SRC" "$DEST"
echo "[fx-bridge] Cloned peer0 → peer${INDEX} for ${ORG} (dev only — use Fabric CA in production)"
