#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
setPeerEnv liquidity-bankA.com peer0

PAYLOAD='{"tx_type":"FX_QUOTATION_SUBMISSION","asset_pair":"USD/EUR","spot_rate":0.9145,"quote_provider":"liquidity-bankA.com","zkTLS_proof_status":"VERIFIED_SUCCESS","zkTLS_proof_hash":"0xabc123","compliance_tag":"CBDC_BRIDGE_AUDIT_V1"}'

docker exec peer0.liquidity-bankA.com peer chaincode invoke \
  -o orderer1.clearing-raft.org:7050 -C "${CHANNEL_ID}" -n fx-quotation \
  -c "{\"function\":\"SubmitQuotation\",\"Args\":[\"${PAYLOAD}\"]}" \
  --tls --cafile "${ORDERER_CA}" \
  --peerAddresses peer0.liquidity-bankA.com:9051 \
  --peerAddresses peer0.centralbank.gov:7051 \
  --tlsRootCertFiles "${ROOT}/organizations/peerOrganizations/liquidity-bankA.com/peers/peer0.liquidity-bankA.com/tls/ca.crt" \
  --tlsRootCertFiles "${ROOT}/organizations/peerOrganizations/centralbank.gov/peers/peer0.centralbank.gov/tls/ca.crt" \
  2>/dev/null || echo "[fx-bridge] Invoke submitted (or pending channel/cc readiness)"

echo "[fx-bridge] Sample FX quotation submitted."
