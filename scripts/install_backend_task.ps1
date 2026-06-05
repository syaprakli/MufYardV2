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
$pythonExe   = Join-Path $projectRoot ".venv\Scripts\python.exe"
$taskName    = "MufYardBackend"

if (-not (Test-Path $pythonExe)) {
    Write-Error "Python executable not found: $pythonExe"
    exit 1
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-ScheduledTask  -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Output "Existing task removed."
}

$action = New-ScheduledTaskAction `
    -Execute $pythonExe `
    -Argument "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" `
    -WorkingDirectory $projectRoot

# Trigger: At system startup
$trigger = New-ScheduledTaskTrigger -AtStartup

# Settings: restart on failure, run in background
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

# Principal: run as SYSTEM with highest privileges (no login required)
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Environment variable via wrapper — Task Scheduler doesn't support env vars directly,
# so we pass PYTHONPATH inline via cmd /c
$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c set PYTHONPATH=backend && `"$pythonExe`" -m uvicorn app.main:app --host 0.0.0.0 --port 8000" `
    -WorkingDirectory $projectRoot

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Runs MufYard FastAPI backend with uvicorn. Auto-starts at boot." `
    -Force | Out-Null

Write-Output "Task registered: $taskName"

# Start immediately
Start-ScheduledTask -TaskName $taskName
Write-Output "Task started. Waiting 3 seconds for backend to come up..."
Start-Sleep -Seconds 3

try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
    Write-Output "Backend health check: OK - $($resp | ConvertTo-Json -Compress)"
} catch {
    Write-Warning "Backend health check failed (may still be starting): $($_.Exception.Message)"
    Write-Output "Check status with: Get-ScheduledTask -TaskName $taskName"
    Write-Output "Check logs with:   Get-ScheduledTaskInfo -TaskName $taskName"
}
