# Start backend + console + explorer (Components 2 & 3 UIs)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Host "Starting Financial Bridge platform UIs..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; npm run dev"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\console'; npm run dev"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\explorer'; npm run dev"

Write-Host "  Console:      http://localhost:5173"
Write-Host "  Explorer:     http://localhost:5174"
Write-Host "  API (unified): http://localhost:4100"
