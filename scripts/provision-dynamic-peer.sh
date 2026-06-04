#!/usr/bin/env bash
# Enroll dynamic peer identity via Fabric CA (production path)
set -euo pipefail
source "$(dirname "$0")/env.sh"

ORG="${1:?org domain}"
INDEX="${2:?peer index}"
FQDN="peer${INDEX}.${ORG}"
PEER_DIR="${ROOT}/organizations/peerOrganizations/${ORG}/peers/${FQDN}"

case "$ORG" in
  centralbank.gov)
    CA_URL="https://ca.centralbank.gov:7054"
    CA_NAME="ca-centralbank"
    AFFILIATION="centralbank.peer"
    MSP="CentralBankMSP"
    ;;
  liquidity-bankA.com)
    CA_URL="https://ca.liquidity-bankA.com:8054"
    CA_NAME="ca-banka"
    AFFILIATION="banka.peer"
    MSP="LiquidityBankAMSP"
    ;;
  liquidity-bankB.com)
    CA_URL="https://ca.liquidity-bankB.com:9054"
    CA_NAME="ca-bankb"
    AFFILIATION="bankb.peer"
    MSP="LiquidityBankBMSP"
    ;;
  *) echo "Unknown org: $ORG" >&2; exit 1 ;;
esac

CA_CERT="${ROOT}/organizations/peerOrganizations/${ORG}/ca/ca.${ORG}-cert.pem"
mkdir -p "${PEER_DIR}/msp" "${PEER_DIR}/tls"

if [[ ! -f "$CA_CERT" ]]; then
  echo "[fx-bridge] CA cert missing — running init-fabric-ca.sh"
  bash "${ROOT}/scripts/init-fabric-ca.sh"
fi

ENROLL_USER="peer${INDEX}"
ENROLL_SECRET="peer${INDEX}pw"

export FABRIC_CA_CLIENT_HOME="${PEER_DIR}/ca-client"
mkdir -p "${FABRIC_CA_CLIENT_HOME}"

fabric-ca-client enroll -u "https://${ENROLL_USER}:${ENROLL_SECRET}@${CA_URL#https://}" \
  --caname "${CA_NAME}" --csr.hosts "${FQDN},localhost" \
  --mspdir "${PEER_DIR}/msp" --tls.certfiles "${CA_CERT}" 2>/dev/null \
|| fabric-ca-client register --id.name "${ENROLL_USER}" --id.secret "${ENROLL_SECRET}" \
     --id.type peer --id.affiliation "${AFFILIATION}" \
     -u "https://admin:adminpw@${CA_URL#https://}" --caname "${CA_NAME}" --tls.certfiles "${CA_CERT}" \
  && fabric-ca-client enroll -u "https://${ENROLL_USER}:${ENROLL_SECRET}@${CA_URL#https://}" \
     --caname "${CA_NAME}" --csr.hosts "${FQDN},localhost" \
     --mspdir "${PEER_DIR}/msp" --tls.certfiles "${CA_CERT}" 2>/dev/null \
|| bash "${ROOT}/scripts/clone-peer-crypto.sh" "$ORG" "$INDEX"

# TLS enrollment
fabric-ca-client enroll -u "https://${ENROLL_USER}:${ENROLL_SECRET}@${CA_URL#https://}" \
  --enrollment.profile tls --csr.hosts "${FQDN},localhost" \
  --mspdir "${PEER_DIR}/tls" --tls.certfiles "${CA_CERT}" 2>/dev/null \
  || cp -r "${ROOT}/organizations/peerOrganizations/${ORG}/peers/peer0.${ORG}/tls/"* "${PEER_DIR}/tls/" 2>/dev/null || true

echo "[fx-bridge] Dynamic peer enrolled: ${FQDN} (${MSP})"
