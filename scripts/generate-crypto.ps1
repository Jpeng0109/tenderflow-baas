$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
Write-Host "[fx-bridge] Generating crypto material..."
cryptogen generate --config="$Root\config\crypto-config.yaml" --output="$Root\organizations"
Write-Host "[fx-bridge] Done."
