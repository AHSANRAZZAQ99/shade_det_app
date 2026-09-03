param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$backendDir = $PSScriptRoot
$rootDir = Split-Path -Parent $backendDir

function Test-PythonExe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath
    )

    if (-not (Test-Path $ExecutablePath)) {
        return $false
    }

    try {
        & $ExecutablePath --version *> $null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Test-PythonCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandName
    )

    try {
        & $CommandName --version *> $null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

$pythonCandidates = @(
    (Join-Path $backendDir ".venv\Scripts\python.exe"),
    (Join-Path $rootDir ".venv\Scripts\python.exe"),
    (Join-Path (Join-Path $rootDir "fabric-shade-ui") ".venv\Scripts\python.exe")
)

$pythonExe = $null
foreach ($candidate in $pythonCandidates) {
    if (Test-PythonExe -ExecutablePath $candidate) {
        $pythonExe = $candidate
        break
    }
}

if (-not $pythonExe) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd -and (Test-PythonCommand -CommandName "python")) {
        $pythonExe = $pythonCmd.Source
    }
}

if (-not $pythonExe) {
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher -and (Test-PythonCommand -CommandName "py")) {
        $pythonExe = "py"
    }
}

if (-not $pythonExe) {
    throw "Python executable not found. Create a venv or add Python to PATH."
}

$commandText = "Set-Location '$backendDir'; & '$pythonExe' api_server.py"

if ($DryRun) {
    Write-Host $commandText
    exit 0
}

Set-Location $backendDir
& $pythonExe api_server.py
