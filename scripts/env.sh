#!/usr/bin/env bash
# Shared Fabric CLI environment for Financial Bridge BaaS
export ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FABRIC_CFG_PATH="${ROOT}/config"
export CHANNEL_ID="${CHANNEL_ID:-fx-bridge-channel}"
export FABRIC_VERSION="${FABRIC_VERSION:-2.5.12}"

export PATH="${ROOT}/bin:${PATH}"

export ORDERER_CA="${ROOT}/organizations/ordererOrganizations/clearing-raft.org/orderers/orderer1.clearing-raft.org/msp/tlscacerts/tlsca.clearing-raft.org-cert.pem"
export ORDERER_ADMIN_TLS="${ROOT}/organizations/ordererOrganizations/clearing-raft.org/orderers/orderer1.clearing-raft.org/tls/server.crt"
export ORDERER_ADMIN_KEY="${ROOT}/organizations/ordererOrganizations/clearing-raft.org/orderers/orderer1.clearing-raft.org/tls/server.key"
export ORDERER1_ADMIN="orderer1.clearing-raft.org:7053"

export PEER_ORG_DOMAIN="${PEER_ORG_DOMAIN:-centralbank.gov}"
export PEER_ORG_MSP="${PEER_ORG_MSP:-CentralBankMSP}"
export PEER_FQDN="${PEER_FQDN:-peer0.centralbank.gov}"
export PEER_PORT="${PEER_PORT:-7051}"

setPeerEnv() {
  local org="${1:-centralbank.gov}"
  local peer="${2:-peer0}"
  export PEER_ORG_DOMAIN="$org"
  export PEER_FQDN="${peer}.${org}"
  case "$org" in
    centralbank.gov)
      export PEER_ORG_MSP=CentralBankMSP
      export PEER_PORT=$((7051 + ${peer#peer} * 2))
      ;;
    liquidity-bankA.com)
      export PEER_ORG_MSP=LiquidityBankAMSP
      export PEER_PORT=$((9051 + ${peer#peer} * 2))
      ;;
    liquidity-bankB.com)
      export PEER_ORG_MSP=LiquidityBankBMSP
      export PEER_PORT=$((11051 + ${peer#peer} * 2))
      ;;
  esac
  export CORE_PEER_LOCALMSPID="${PEER_ORG_MSP}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${ROOT}/organizations/peerOrganizations/${org}/peers/${PEER_FQDN}/tls/ca.crt"
  export CORE_PEER_TLS_CERT_FILE="${ROOT}/organizations/peerOrganizations/${org}/peers/${PEER_FQDN}/tls/server.crt"
  export CORE_PEER_TLS_KEY_FILE="${ROOT}/organizations/peerOrganizations/${org}/peers/${PEER_FQDN}/tls/server.key"
  export CORE_PEER_MSPCONFIGPATH="${ROOT}/organizations/peerOrganizations/${org}/users/Admin@${org}/msp"
  export CORE_PEER_ADDRESS="${PEER_FQDN}:${PEER_PORT}"
  export CORE_PEER_TLS_ENABLED=true
}
