[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TaskName,
    [int]$Hours = 3,
    [switch]$Remove
)

# Registers the post performance judgment (node tools/<post-performance>.js --run via run-hidden.py) as a hidden repeating Windows task.
# No AI: it reads the company server read-only, judges, writes the ledger and the episode folders, and pushes only those paths.
#   pwsh -NoProfile -File tools/<post-performance task folder>/install-task.ps1 -TaskName "<task name>" [-Hours 3] [-Remove]
# StartWhenAvailable catches up after the PC was asleep; the judgment itself never depends on running exactly on time
# (the server records the 24h/72h checkpoints and the daily numbers on its own).
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'run-hidden.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
$arguments = '-X utf8 -B "{0}"' -f $launcher
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
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours $Hours)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "SYNK post performance judgment every $Hours hours. No AI: reads the company server read-only and writes the ledger and episode folders."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName (every $Hours h, current interactive user, no elevation)"
