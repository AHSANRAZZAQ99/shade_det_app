param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$frontendDir = Join-Path $root "fabric-shade-ui"
$backendDir = Join-Path $root "backend"

if (-not (Test-Path $frontendDir)) {
    throw "Frontend directory not found: $frontendDir"
}

if (-not (Test-Path $backendDir)) {
    throw "Backend directory not found: $backendDir"
}

$frontendCmd = "Set-Location '$frontendDir'; npm start"
$backendCmd = "Set-Location '$backendDir'; powershell -ExecutionPolicy Bypass -File .\start-backend.ps1"

if ($DryRun) {
    Write-Host "Run frontend separately: $frontendCmd"
    Write-Host "Run backend separately : $backendCmd"
    exit 0
}

Write-Host "Run the apps separately:"
Write-Host "Frontend: $frontendCmd"
Write-Host "Backend : $backendCmd"
