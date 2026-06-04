#!/usr/bin/env bash
PEER="${1:-peer0.centralbank.gov}"
CHANNEL="${2:-fx-bridge-channel}"
docker exec "$PEER" peer channel getinfo -c "$CHANNEL" 2>/dev/null \
  | awk -F: '/Blockchain info/ {gsub(/ /,"",$2); print $2}' \
  | head -1 \
  || echo "0"
