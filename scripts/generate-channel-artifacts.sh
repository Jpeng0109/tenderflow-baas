#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
mkdir -p "${ROOT}/channel-artifacts"

# Channel participation (no system channel): application channel genesis block
configtxgen -profile FxBridgeChannel \
  -outputBlock "${ROOT}/channel-artifacts/${CHANNEL_ID}.block" \
  -channelID "${CHANNEL_ID}"

configtxgen -profile FxBridgeChannel \
  -outputCreateChannelTx "${ROOT}/channel-artifacts/${CHANNEL_ID}.tx" \
  -channelID "${CHANNEL_ID}"

configtxgen -profile FxBridgeChannel \
  -outputAnchorPeersUpdate "${ROOT}/channel-artifacts/CentralBankMSPanchors.tx" \
  -channelID "${CHANNEL_ID}" -asOrg CentralBankMSP

configtxgen -profile FxBridgeChannel \
  -outputAnchorPeersUpdate "${ROOT}/channel-artifacts/LiquidityBankAMSPanchors.tx" \
  -channelID "${CHANNEL_ID}" -asOrg LiquidityBankAMSP

configtxgen -profile FxBridgeChannel \
  -outputAnchorPeersUpdate "${ROOT}/channel-artifacts/LiquidityBankBMSPanchors.tx" \
  -channelID "${CHANNEL_ID}" -asOrg LiquidityBankBMSP

echo "[fx-bridge] Channel artifacts: ${ROOT}/channel-artifacts/${CHANNEL_ID}.block"
