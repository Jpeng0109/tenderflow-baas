#!/usr/bin/env bash
export CC_NAME=fx-matching
export CC_VERSION=1.0
export CC_SEQUENCE=2
export CC_LABEL=fxmatching_1
exec "$(dirname "$0")/deploy-chaincode.sh"
