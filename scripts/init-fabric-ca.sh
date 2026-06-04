#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"

init_ca() {
  local org="$1" port="$2" cfg="$3"
  local dir="${ROOT}/organizations/fabric-ca/${org}"
  mkdir -p "$dir"
  if [[ ! -f "${dir}/ca-cert.pem" ]]; then
    docker run --rm -v "${ROOT}/config/fabric-ca:/config" -v "${dir}:/etc/hyperledger/fabric-ca-server" \
      hyperledger/fabric-ca:1.5 \
      sh -c "fabric-ca-server init -b admin:adminpw -c /config/${cfg}"
    cp "${dir}/ca-cert.pem" "${ROOT}/organizations/peerOrganizations/${org}/ca/ca.${org}-cert.pem" 2>/dev/null \
      || mkdir -p "${ROOT}/organizations/peerOrganizations/${org}/ca" \
      && cp "${dir}/ca-cert.pem" "${ROOT}/organizations/peerOrganizations/${org}/ca/ca.${org}-cert.pem"
  fi
  echo "[fx-bridge] CA initialized: ${org}:${port}"
}

mkdir -p "${ROOT}/organizations/peerOrganizations/centralbank.gov/ca"
mkdir -p "${ROOT}/organizations/peerOrganizations/liquidity-bankA.com/ca"
mkdir -p "${ROOT}/organizations/peerOrganizations/liquidity-bankB.com/ca"

init_ca centralbank.gov 7054 ca-centralbank.yaml
init_ca liquidity-bankA.com 8054 ca-banka.yaml
init_ca liquidity-bankB.com 9054 ca-bankb.yaml
