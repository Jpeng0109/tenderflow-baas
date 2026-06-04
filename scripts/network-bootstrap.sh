#!/usr/bin/env bash
# Full Financial Bridge bootstrap pipeline (Phase 2 complete)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== [1/7] Crypto material (cryptogen) ==="
bash scripts/generate-crypto.sh

echo "=== [2/7] Fabric CA initialization ==="
bash scripts/init-fabric-ca.sh || echo "[warn] CA init skipped (docker required)"

echo "=== [3/7] Channel artifacts ==="
bash scripts/generate-channel-artifacts.sh

echo "=== [4/7] Docker compose — 14 nodes + CAs + APIs ==="
cd docker
docker compose -f docker-compose-fabric-14.yaml --env-file .env up -d

echo "=== [5/7] Waiting for orderers/peers (30s) ==="
sleep 30

cd "$ROOT"
echo "=== [6/7] Channel participation + peer join ==="
bash scripts/channel-setup.sh || echo "[warn] channel-setup partial — retry when nodes healthy"

echo "=== [7/7] Chaincode deploy + sample quotation ==="
bash scripts/deploy-chaincode.sh || echo "[warn] fx-quotation deploy pending"
bash scripts/deploy-matching-chaincode.sh || echo "[warn] fx-matching deploy optional"
bash scripts/submit-sample-quotation.sh || true

echo ""
echo "[fx-bridge] Bootstrap complete."
echo "  Console:    http://localhost:5173"
echo "  Explorer:   http://localhost:5174"
echo "  Orchestrator API: http://localhost:4100"
echo "  Explorer API:     http://localhost:4200"
