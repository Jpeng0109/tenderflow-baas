# TENDERFLOW — Start 14-node Fabric mainnet (bootstrap + verify)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== TENDERFLOW Mainnet Bootstrap ===" -ForegroundColor Cyan

# Wait for Docker (max 5 min)
$deadline = (Get-Date).AddMinutes(5)
$dockerOk = $false
while ((Get-Date) -lt $deadline) {
    try {
        docker ps 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $dockerOk = $true
            break
        }
    } catch { }
    Write-Host "  Waiting for Docker Desktop..." -ForegroundColor Yellow
    Start-Sleep -Seconds 8
}

if (-not $dockerOk) {
    Write-Host ""
    Write-Host "Docker is NOT running. Please:" -ForegroundColor Red
    Write-Host "  1. Open 'Docker Desktop' from Start menu"
    Write-Host "  2. Wait until status shows 'Engine running' (green)"
    Write-Host "  3. Re-run: .\scripts\start-mainnet.ps1"
    exit 1
}

Write-Host "Docker OK: $(docker version --format 'Server {{.Server.Version}}')" -ForegroundColor Green
Write-Host ""
Write-Host "Step 1/2: Bootstrap crypto + 14 nodes + channel + chaincode..." -ForegroundColor Cyan
& "$Root\scripts\bootstrap.ps1"

Write-Host ""
Write-Host "Step 2/2: Start platform UIs..." -ForegroundColor Cyan
& "$Root\scripts\start-platform.ps1"

Write-Host ""
Write-Host "[TENDERFLOW] Mainnet bootstrap complete." -ForegroundColor Green
Write-Host "  Console:  http://localhost:5173"
Write-Host "  Explorer: http://localhost:5174"
Write-Host "  API:      http://localhost:4100"
Write-Host ""
Write-Host "Refresh paper explorer figures (after live txs):" -ForegroundColor Cyan
Write-Host "  cd paper && python generate_explorer_figures.py && python generate_paper.py"
