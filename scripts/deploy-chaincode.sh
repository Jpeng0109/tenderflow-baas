#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"

CC_NAME="${CC_NAME:-fx-quotation}"
CC_VERSION="${CC_VERSION:-1.0}"
CC_SEQUENCE="${CC_SEQUENCE:-1}"
CC_LABEL="${CC_LABEL:-fxquotation_1}"
PACKAGE="${ROOT}/chaincode/${CC_NAME}.tar.gz"
COLLECTIONS="${ROOT}/config/collections_config.json"

cd "${ROOT}/chaincode/${CC_NAME}"
if command -v go >/dev/null 2>&1; then
  GO111MODULE=on go mod vendor 2>/dev/null || true
fi

peer lifecycle chaincode package "${PACKAGE}" \
  --path "${ROOT}/chaincode/${CC_NAME}" \
  --lang golang --label "${CC_LABEL}" 2>/dev/null \
|| docker run --rm -v "${ROOT}:/work" -w /work/chaincode/${CC_NAME} \
  golang:1.22-alpine sh -c "apk add git && go mod vendor" \
  && peer lifecycle chaincode package "${PACKAGE}" \
     --path "${ROOT}/chaincode/${CC_NAME}" --lang golang --label "${CC_LABEL}"

install_on_org() {
  local org="$1" peer="$2"
  setPeerEnv "$org" "$peer"
  echo "[fx-bridge] install ${CC_NAME} on ${PEER_FQDN}"
  docker cp "${PACKAGE}" "${PEER_FQDN}:/tmp/${CC_NAME}.tar.gz"
  docker exec "${PEER_FQDN}" peer lifecycle chaincode install "/tmp/${CC_NAME}.tar.gz" \
    || peer lifecycle chaincode install "${PACKAGE}"
}

approve_on_org() {
  local org="$1" peer="$2" msp="$3"
  setPeerEnv "$org" "$peer"
  local pkg_id
  pkg_id=$(docker exec "${PEER_FQDN}" peer lifecycle chaincode queryinstalled 2>/dev/null | awk "/${CC_LABEL}/ {print \$3}" | sed 's/,$//' | head -1)
  [[ -z "$pkg_id" ]] && pkg_id=$(peer lifecycle chaincode queryinstalled | awk "/${CC_LABEL}/ {print \$3}" | sed 's/,$//' | head -1)
  echo "[fx-bridge] approve ${CC_NAME} ${msp} package ${pkg_id}"
  docker exec "${PEER_FQDN}" peer lifecycle chaincode approveformyorg \
    -o orderer1.clearing-raft.org:7050 --channelID "${CHANNEL_ID}" --name "${CC_NAME}" \
    --version "${CC_VERSION}" --package-id "${pkg_id}" --sequence "${CC_SEQUENCE}" \
    --tls --cafile "${ORDERER_CA}" \
    || peer lifecycle chaincode approveformyorg \
    -o orderer1.clearing-raft.org:7050 --channelID "${CHANNEL_ID}" --name "${CC_NAME}" \
    --version "${CC_VERSION}" --package-id "${pkg_id}" --sequence "${CC_SEQUENCE}" \
    --tls --cafile "${ORDERER_CA}"
}

install_on_org centralbank.gov peer0
install_on_org liquidity-bankA.com peer0
install_on_org liquidity-bankB.com peer0

approve_on_org centralbank.gov peer0 CentralBankMSP
approve_on_org liquidity-bankA.com peer0 LiquidityBankAMSP
approve_on_org liquidity-bankB.com peer0 LiquidityBankBMSP

setPeerEnv centralbank.gov peer0
docker exec peer0.centralbank.gov peer lifecycle chaincode commit \
  -o orderer1.clearing-raft.org:7050 --channelID "${CHANNEL_ID}" --name "${CC_NAME}" \
  --version "${CC_VERSION}" --sequence "${CC_SEQUENCE}" \
  --peerAddresses peer0.centralbank.gov:7051 \
  --peerAddresses peer0.liquidity-bankA.com:9051 \
  --peerAddresses peer0.liquidity-bankB.com:11051 \
  --tlsRootCertFiles "${ROOT}/organizations/peerOrganizations/centralbank.gov/peers/peer0.centralbank.gov/tls/ca.crt" \
  --tlsRootCertFiles "${ROOT}/organizations/peerOrganizations/liquidity-bankA.com/peers/peer0.liquidity-bankA.com/tls/ca.crt" \
  --tlsRootCertFiles "${ROOT}/organizations/peerOrganizations/liquidity-bankB.com/peers/peer0.liquidity-bankB.com/tls/ca.crt" \
  --tls --cafile "${ORDERER_CA}" 2>/dev/null \
|| peer lifecycle chaincode commit \
  -o orderer1.clearing-raft.org:7050 --channelID "${CHANNEL_ID}" --name "${CC_NAME}" \
  --version "${CC_VERSION}" --sequence "${CC_SEQUENCE}" \
  --peerAddresses peer0.centralbank.gov:7051 \
  --peerAddresses peer0.liquidity-bankA.com:9051 \
  --peerAddresses peer0.liquidity-bankB.com:11051 \
  --tlsRootCertFiles "${CORE_PEER_TLS_ROOTCERT_FILE}" \
  --tls --cafile "${ORDERER_CA}"

echo "[fx-bridge] Chaincode ${CC_NAME}@${CC_VERSION} committed on ${CHANNEL_ID}"
