[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Job,
    [Parameter(Mandatory = $true)][string]$TaskName,
    [int]$Minutes = 15,
    # Once a day at this local time (HH:mm) instead of every -Minutes. A missed run starts when the PC is next available.
    [string]$DailyAt = '',
    # Task priority 0-10. Windows default is 7 (below-normal CPU, low I/O, inherited by child tests and browsers); heavy jobs use 4.
    [ValidateRange(0, 10)][int]$Priority = 7,
    [ValidateRange(1, 72)][int]$HoursLimit = 3,
    [switch]$Remove
)

# Registers a credit job (tools/credit-job/<Job>.js via run-hidden.py) as a hidden Windows task.
# The job's own pre-check runs without AI and ends at once when there is nothing to do, so a short interval costs nothing.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/<credit-job folder>/install-task.ps1 -Job <name> -TaskName "<task>" [-Minutes 15 | -DailyAt 10:30] [-Priority 4] [-HoursLimit 3] [-Remove]
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'run-hidden.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
$arguments = '-X utf8 -B "{0}" {1}' -f $launcher, $Job
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    # The same launcher folder and job under the ops copy or the main checkout is this task (2026-10-22).
    $tail = '\{0}\run-hidden.py" {1}' -f (Split-Path $PSScriptRoot -Leaf), $Job
    $owned = @($existing.Actions).Count -eq 1 -and ($existing.Actions[0].Arguments -eq $arguments -or $existing.Actions[0].Arguments.EndsWith($tail))
    if (!$owned) { throw 'A different task already uses this name. Refusing to modify it.' }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
    Write-Output "Removed: $TaskName"
    exit 0
}
if (!(Test-Path -LiteralPath $launcher)) { throw 'run-hidden.py missing' }
if (!(Test-Path -LiteralPath $pythonw)) { throw "pythonw missing: $pythonw" }
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot "$Job.js"))) { throw "Job file missing: $Job.js" }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ($DailyAt) {
    if ($DailyAt -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw "DailyAt must be HH:mm: $DailyAt" }
    $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($DailyAt, 'HH:mm', $null))
    $when = "daily at $DailyAt"
} else {
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
    $when = "every $Minutes minutes"
}
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
# One run at a time (the job also locks itself); a review run can take up to two hours.
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority $Priority -ExecutionTimeLimit (New-TimeSpan -Hours $HoursLimit)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "SYNK credit job '$Job' $when. The pre-check uses no AI and ends at once when there is nothing to do."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName ($when, priority $Priority, limit $HoursLimit h, current interactive user, no elevation)"
