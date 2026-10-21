$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$backendDir = Join-Path $projectRoot "backend"
$pythonwExe = Join-Path $projectRoot ".venv\Scripts\pythonw.exe"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

$targetExe = if (Test-Path $pythonwExe) { $pythonwExe } else { $pythonExe }

if (-not (Test-Path $targetExe)) {
    throw "Python executable not found: $targetExe"
}

$existing = Get-CimInstance Win32_Process -Filter "Name LIKE 'python%'" |
    Where-Object { $_.CommandLine -like "*uvicorn app.main:app*--port 8000*" }

if ($existing) {
    Write-Output "Backend already running on port 8000."
    exit 0
}

Start-Process -FilePath $targetExe -ArgumentList @(
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8000"
) -WorkingDirectory $backendDir

Write-Output "Backend process started."
