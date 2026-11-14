[CmdletBinding()]
param(
    [string]$TaskName = 'SYNK 스레드 21시 게시',
    [string]$At = '21:00',
    [switch]$Remove
)

# Registers the daily Threads post (node tools/<threads task folder>/<post>.js via run-hidden.py) as a hidden Windows task.
# No AI: it checks the final-review record of today's episode and runs the existing ego script once.
# Run it from the ops copy so the task points at the ops copy's code:
#   pwsh -NoProfile -File "$env:LOCALAPPDATA\synk\ops\SYNK-appsscript\tools\<threads task folder>\install-task.ps1" [-At 21:00] [-Remove]
# StartWhenAvailable lets a missed 21:00 run later the same evening; the script itself refuses to post outside 20:55-23:59 KST.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'run-hidden.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
$arguments = '-X utf8 -B "{0}"' -f $launcher
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    $tail = '\{0}\run-hidden.py"' -f (Split-Path $PSScriptRoot -Leaf)
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
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority 4 -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "SYNK Threads post at $At every day. No AI: posts today's yuhobuilds Threads episode only when its final review passed."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskName (daily $At, current interactive user, no elevation)"
