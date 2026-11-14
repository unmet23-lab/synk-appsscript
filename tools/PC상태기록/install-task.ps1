[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TaskName,
    [switch]$Remove
)

# Registers the PC state logger (tools/<pc state folder>/<logger>.py) as a hidden Windows task that runs every minute.
# No AI and no network: it appends one line (CPU, memory, commit, process count, disk write time, top memory programs)
# to %LOCALAPPDATA%\synk\pc-state\YYYY-MM-DD.tsv so the minutes before a freeze can be read afterwards.
# Run it from the ops copy so the task points at the ops copy's code:
#   pwsh -NoProfile -File "$env:LOCALAPPDATA\synk\ops\SYNK-appsscript\tools\<pc state folder>\install-task.ps1" -TaskName "<task name>" [-Remove]
$ErrorActionPreference = 'Stop'
$script = Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.py' | Select-Object -First 1
if (!$script) { throw 'logger script missing' }
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
$arguments = '-X utf8 -B "{0}"' -f $script.FullName
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    $tail = '\{0}\{1}"' -f (Split-Path $PSScriptRoot -Leaf), $script.Name
    $owned = @($existing.Actions).Count -eq 1 -and ($existing.Actions[0].Arguments -eq $arguments -or $existing.Actions[0].Arguments.EndsWith($tail))
    if (!$owned) { throw 'A different task already uses this name. Refusing to modify it.' }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
    Write-Output "Removed: $TaskName"
    exit 0
}
if (!(Test-Path -LiteralPath $pythonw)) { throw "pythonw missing: $pythonw" }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$start = (Get-Date).Date.AddHours((Get-Date).Hour).AddMinutes((Get-Date).Minute + 2)
$trigger = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority 4 -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'SYNK PC state log every minute. No AI, no network: one line of CPU, memory, commit, process count and disk write time, kept 14 days.'
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName (every minute, current interactive user, no elevation)"
