$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$env:PYTHONPATH = "backend"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    throw "Python executable not found: $pythonExe"
}

$existing = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -like "*uvicorn app.main:app*--port 8000*" }

if ($existing) {
    Write-Output "Backend already running on port 8000."
    exit 0
}

Start-Process -FilePath $pythonExe -ArgumentList @(
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8000"
) -WorkingDirectory $projectRoot -WindowStyle Hidden

Write-Output "Backend process started."