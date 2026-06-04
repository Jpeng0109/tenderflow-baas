# Financial Bridge — Windows bootstrap (3-step blockchain layer)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Step 1/3: Crypto + channel artifacts ===" -ForegroundColor Cyan
if (Get-Command cryptogen -ErrorAction SilentlyContinue) {
    & "$Root\scripts\generate-crypto.ps1"
} else {
    Write-Host "cryptogen not in PATH — using Docker fabric-tools..." -ForegroundColor Yellow
    docker run --rm -v "${Root}:/work" -w /work hyperledger/fabric-tools:2.5.12 `
        cryptogen generate --config=/work/config/crypto-config.yaml --output=/work/organizations
}

docker run --rm -v "${Root}:/work" -w /work -e FABRIC_CFG_PATH=/work/config `
    hyperledger/fabric-tools:2.5.12 sh -c @"
mkdir -p /work/channel-artifacts
configtxgen -profile FxBridgeChannel -outputBlock /work/channel-artifacts/fx-bridge-channel.block -channelID fx-bridge-channel
configtxgen -profile FxBridgeChannel -outputCreateChannelTx /work/channel-artifacts/fx-bridge-channel.tx -channelID fx-bridge-channel
"@

Write-Host "=== Step 2/3: Fabric CA init + Docker compose (14 nodes) ===" -ForegroundColor Cyan
@(
    "organizations\fabric-ca\centralbank.gov",
    "organizations\fabric-ca\liquidity-bankA.com",
    "organizations\fabric-ca\liquidity-bankB.com"
) | ForEach-Object {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $_) | Out-Null
}

Set-Location (Join-Path $Root "docker")
docker compose -f docker-compose-fabric-14.yaml --env-file .env up -d
Start-Sleep -Seconds 35

Write-Host "=== Step 3/3: Channel join + chaincode (via WSL/Git Bash if available) ===" -ForegroundColor Cyan
$bash = Get-Command bash -ErrorAction SilentlyContinue
if ($bash) {
    Set-Location $Root
    bash scripts/channel-setup.sh
    bash scripts/deploy-chaincode.sh
    bash scripts/submit-sample-quotation.sh
} else {
    Write-Host "Install Git Bash/WSL and run: bash scripts/channel-setup.sh" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[fx-bridge] Blockchain layer ready." -ForegroundColor Green
Write-Host "  Run platform: .\scripts\start-platform.ps1"
