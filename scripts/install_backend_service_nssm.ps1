$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Error "Administrator privileges are required. Run PowerShell as Administrator and retry."
    exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot "tools"
$nssmRoot = Join-Path $toolsDir "nssm"
$nssmExe = Join-Path $nssmRoot "win64\nssm.exe"

if (-not (Test-Path $nssmExe)) {
    New-Item -Path $nssmRoot -ItemType Directory -Force | Out-Null

    $downloadCandidates = @(
        "https://nssm.cc/release/nssm-2.24.zip",
        "https://github.com/kirillkovalenko/nssm/releases/download/2.24-103-gdee49fc/nssm-2.24-103-gdee49fc.zip",
        "https://github.com/nssm/nssm/releases/download/2.24/nssm-2.24.zip"
    )

    $downloadOk = $false
    $archivePath = $null

    foreach ($url in $downloadCandidates) {
        try {
            $archivePath = Join-Path $env:TEMP ("nssm-download-" + [guid]::NewGuid().ToString() + ".zip")
            Invoke-WebRequest -Uri $url -OutFile $archivePath -UseBasicParsing
            if ((Test-Path $archivePath) -and ((Get-Item $archivePath).Length -gt 0)) {
                $downloadOk = $true
                Write-Output "NSSM downloaded from: $url"
                break
            }
        } catch {
            Write-Warning "NSSM download failed from $url : $($_.Exception.Message)"
        }
    }

    if (-not $downloadOk) {
        Write-Error "NSSM could not be downloaded from all known mirrors."
        exit 1
    }

    Expand-Archive -Path $archivePath -DestinationPath $nssmRoot -Force

    $foundExe = Get-ChildItem -Path $nssmRoot -Recurse -Filter nssm.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "win64" } |
        Select-Object -First 1

    if (-not $foundExe) {
        $foundExe = Get-ChildItem -Path $nssmRoot -Recurse -Filter nssm.exe -ErrorAction SilentlyContinue |
            Select-Object -First 1
    }

    if ($foundExe) {
        $targetDir = Split-Path -Parent $nssmExe
        New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
        Copy-Item -Path $foundExe.FullName -Destination $nssmExe -Force
    }
}

if (-not (Test-Path $nssmExe)) {
    Write-Error "nssm.exe not found after download: $nssmExe"
    exit 1
}

$serviceName = "MufYardBackend"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Error "Python executable not found: $pythonExe"
    exit 1
}

& $nssmExe stop $serviceName | Out-Null
& $nssmExe remove $serviceName confirm | Out-Null

& $nssmExe install $serviceName $pythonExe "-m uvicorn app.main:app --host 0.0.0.0 --port 8000"
& $nssmExe set $serviceName AppDirectory $projectRoot
& $nssmExe set $serviceName AppEnvironmentExtra "PYTHONPATH=backend"
& $nssmExe set $serviceName Start SERVICE_AUTO_START
& $nssmExe set $serviceName DisplayName "MufYard Backend Service"
& $nssmExe set $serviceName Description "Runs MufYard FastAPI backend with uvicorn."

& $nssmExe start $serviceName

Write-Output "Service installed and started: $serviceName"