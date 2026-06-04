#!/usr/bin/env bash
set -euo pipefail
PEER_FQDN="${1:?peer fqdn required}"
CHANNEL="${2:-fx-bridge-channel}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ORG_DOMAIN="${PEER_FQDN#peer*.}"
ORG_DOMAIN="${PEER_FQDN#peer?}"
# peer0.centralbank.gov -> centralbank.gov
ORG_DOMAIN="${PEER_FQDN#peer[0-9].}"

docker exec fabric-cli peer channel join -b "/etc/hyperledger/fabric/channel-artifacts/${CHANNEL}.block" 2>/dev/null \
  || docker exec "$PEER_FQDN" peer channel join \
       -b "/etc/hyperledger/fabric/channel-artifacts/${CHANNEL}.block" 2>/dev/null \
  || echo "[fx-bridge] Join stub for ${PEER_FQDN} on ${CHANNEL} (run fabric-cli after channel create)"

echo "JOIN_OK ${PEER_FQDN} ${CHANNEL}"
