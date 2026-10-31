[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TaskName,
    [int]$Hours = 3,
    [switch]$Remove
)

# Registers the daily Clarity pull (node tools/<report tool>/<report>.js pull --all via run-hidden.py) as a hidden repeating Windows task.
# No AI: it reads the Clarity Data Export API with the token in ~/SYNK_security and appends to a ledger outside git.
# It wakes every few hours, but the tool skips the API unless 23 hours passed since the last pull, so the 24-hour windows stay end to end.
#   pwsh -NoProfile -File <ops copy>/tools/<report tool>/<task folder>/install-task.ps1 -TaskName "<task name>" [-Hours 3] [-Remove]
# Install it from the ops copy so it runs code that follows origin (docs/_ops gate table).
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'run-hidden.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
$arguments = '-X utf8 -B "{0}"' -f $launcher
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    $owned = @($existing.Actions).Count -eq 1 -and $existing.Actions[0].Arguments -eq $arguments
    if (!$owned) { throw 'A different task already uses this name. Refusing to modify it.' }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
    Write-Output "Removed: $TaskName"
    exit 0
}
if (!(Test-Path -LiteralPath $launcher)) { throw 'run-hidden.py missing' }
if (!(Test-Path -LiteralPath $pythonw)) { throw "pythonw missing: $pythonw" }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours $Hours)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "SYNK ad reaction report: daily Clarity numbers for landing pages. No AI: reads the Clarity Data Export API and appends to a ledger outside git."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName (wakes every $Hours h, current interactive user, no elevation)"
