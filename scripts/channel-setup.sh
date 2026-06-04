#!/usr/bin/env bash
# Channel participation bootstrap: osnadmin join → peer join → anchor updates
set -euo pipefail
source "$(dirname "$0")/env.sh"

BLOCK="${ROOT}/channel-artifacts/${CHANNEL_ID}.block"
if [[ ! -f "$BLOCK" ]]; then
  echo "Missing ${BLOCK}. Run generate-channel-artifacts.sh first." >&2
  exit 1
fi

join_orderer() {
  local name="$1" admin_port="$2"
  echo "[fx-bridge] osnadmin join ${name} → ${CHANNEL_ID}"
  docker exec "$name" osnadmin channel join \
    --channelID "${CHANNEL_ID}" \
    --config-block "/var/hyperledger/orderer/channel-artifacts/${CHANNEL_ID}.block" 2>/dev/null \
  || osnadmin channel join \
    --channelID "${CHANNEL_ID}" \
    --config-block "${BLOCK}" \
    -o "${name}:${admin_port}" \
    --ca-file "${ORDERER_CA}" \
    --client-cert "${ORDERER_ADMIN_TLS}" \
    --client-key "${ORDERER_ADMIN_KEY}" \
  || echo "[warn] orderer join may already exist: ${name}"
}

# Mount block into orderers via docker cp if not volume-mounted
for o in orderer1 orderer2 orderer3 orderer4 orderer5; do
  fqdn="${o}.clearing-raft.org"
  docker exec "$fqdn" mkdir -p /var/hyperledger/orderer/channel-artifacts 2>/dev/null || true
  docker cp "${BLOCK}" "${fqdn}:/var/hyperledger/orderer/channel-artifacts/${CHANNEL_ID}.block" 2>/dev/null || true
done

join_orderer orderer1.clearing-raft.org 7053
join_orderer orderer2.clearing-raft.org 8053
join_orderer orderer3.clearing-raft.org 9053
join_orderer orderer4.clearing-raft.org 10053
join_orderer orderer5.clearing-raft.org 11053

join_peer() {
  local org="$1" peer="$2"
  setPeerEnv "$org" "$peer"
  echo "[fx-bridge] peer channel join ${PEER_FQDN}"
  docker cp "${BLOCK}" "${PEER_FQDN}:/etc/hyperledger/fabric/${CHANNEL_ID}.block"
  docker exec -e CORE_PEER_LOCALMSPID -e CORE_PEER_ADDRESS -e CORE_PEER_MSPCONFIGPATH \
    -e CORE_PEER_TLS_ENABLED -e CORE_PEER_TLS_ROOTCERT_FILE \
    "${PEER_FQDN}" peer channel join -b "/etc/hyperledger/fabric/${CHANNEL_ID}.block" \
    || peer channel join -b "${BLOCK}" 2>/dev/null \
    || echo "[warn] peer join skip ${PEER_FQDN}"
}

for org in centralbank.gov liquidity-bankA.com liquidity-bankB.com; do
  for idx in 0 1 2; do
    join_peer "$org" "peer${idx}"
  done
done

update_anchor() {
  local org="$1" msp="$2" tx="$3" peer="$4"
  setPeerEnv "$org" "$peer"
  docker cp "${ROOT}/channel-artifacts/${tx}" "${PEER_FQDN}:/etc/hyperledger/fabric/${tx}"
  docker exec "${PEER_FQDN}" peer channel update \
    -o orderer1.clearing-raft.org:7050 \
    -c "${CHANNEL_ID}" -f "/etc/hyperledger/fabric/${tx}" \
    --tls --cafile "${ORDERER_CA}" 2>/dev/null \
    || echo "[warn] anchor update ${msp}"
}

update_anchor centralbank.gov CentralBankMSPanchors.tx peer0
update_anchor liquidity-bankA.com LiquidityBankAMSPanchors.tx peer0
update_anchor liquidity-bankB.com LiquidityBankBMSPanchors.tx peer0

echo "[fx-bridge] Channel ${CHANNEL_ID} setup complete."
