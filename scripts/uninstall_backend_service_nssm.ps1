$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Error "Administrator privileges are required. Run PowerShell as Administrator and retry."
    exit 1
}

$scriptDir = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $scriptDir
$nssmExe = Join-Path $projectRoot "tools\nssm\win64\nssm.exe"
$serviceName = "MufYardBackend"

if (-not (Test-Path $nssmExe)) {
    Write-Error "nssm.exe not found: $nssmExe"
    exit 1
}

& $nssmExe stop $serviceName | Out-Null
& $nssmExe remove $serviceName confirm

Write-Output "Service removed: $serviceName"