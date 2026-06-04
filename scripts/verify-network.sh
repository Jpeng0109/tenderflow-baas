#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
PASS=0
FAIL=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "  OK  $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "[fx-bridge] Network verification"
check "crypto exists" "test -d ${ROOT}/organizations/ordererOrganizations"
check "channel block" "test -f ${ROOT}/channel-artifacts/${CHANNEL_ID}.block"
check "orderer1 up" "docker ps --format '{{.Names}}' | grep -q orderer1.clearing-raft.org"
check "peer0 centralbank up" "docker ps --format '{{.Names}}' | grep -q peer0.centralbank.gov"
check "couchdb up" "docker ps --format '{{.Names}}' | grep -q couchdb0.centralbank.gov"
check "orchestrator api" "curl -sf http://localhost:4100/health"
check "explorer api" "curl -sf http://localhost:4200/health"

echo ""
echo "Result: ${PASS} passed, ${FAIL} failed"
[[ $FAIL -eq 0 ]]
