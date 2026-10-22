[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Job,
    [Parameter(Mandatory = $true)][string]$TaskName,
    [int]$Minutes = 15,
    [switch]$Remove
)

# Registers a credit job (tools/credit-job/<Job>.js via run-hidden.py) as a hidden repeating Windows task.
# The job's own pre-check runs without AI and ends at once when there is nothing to do, so a short interval costs nothing.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/<credit-job folder>/install-task.ps1 -Job <name> -TaskName "<task>" [-Minutes 15] [-Remove]
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
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
# One run at a time (the job also locks itself); a review run can take up to two hours.
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "SYNK credit job '$Job' every $Minutes minutes. The pre-check uses no AI and ends at once when there is nothing to do."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName (every $Minutes min, current interactive user, no elevation)"
