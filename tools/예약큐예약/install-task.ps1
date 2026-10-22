[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TaskName,
    [int]$Minutes = 30,
    [switch]$Remove
)

# Registers the daily-content queue job (run-hidden.py: workspace registration of ready episodes + read-only server reconciliation
# and Telegram alert) as a hidden repeating Windows task. No AI. Mirrors tools/<post-performance task folder>/install-task.ps1.
#   pwsh -NoProfile -File tools/<queue task folder>/install-task.ps1 -TaskName "<task name>" [-Minutes 30] [-Remove]
# StartWhenAvailable catches up after sleep. Registration never publishes: the company server holds every job until the owner
# approves the review link sent by Telegram.
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
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "SYNK daily-content queue every $Minutes minutes. No AI: registers ready episodes in the company workspace (held until the owner approves the review link) and reads the server read-only for the reserve alert."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName (every $Minutes min, current interactive user, no elevation)"
