[CmdletBinding()]
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$taskName = 'SYNK_Hermes_Gateway_Recovery'
$scriptPath = Join-Path $PSScriptRoot 'recover-gateway.ps1'
# Use the Windows PowerShell that ships with Windows. Installing from the Codex app shell resolved
# pwsh.exe to the Codex runtime, tying this task to that app (2026-10-19).
$pwshPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
# Run it inside a headless console. Started directly, Windows 11 hands the new console to Windows Terminal
# and a terminal window opened on the user's screen every ten minutes; -WindowStyle Hidden only hides it after
# PowerShell has started (2026-11-15). conhost --headless gives PowerShell a console with no window at all.
$conhostPath = Join-Path $env:SystemRoot 'System32\conhost.exe'
# Windows PowerShell defaults to the Restricted policy; bypass it for this one script only.
$arguments = '--headless "{0}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}"' -f $pwshPath, $scriptPath
$previousArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}"' -f $scriptPath
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    # The same script under the ops copy or the main checkout is this task (2026-10-22).
    $owned = @($existing.Actions).Count -eq 1 -and
        ($existing.Actions[0].Arguments -in @($arguments, $previousArguments) -or
         $existing.Actions[0].Arguments.EndsWith('\tools\hermes-synk\runtime\recover-gateway.ps1"'))
    if (!$owned) { throw 'A different task already uses this name. Refusing to modify it.' }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
    Write-Output 'SYNK recovery task removed. The original Hermes startup entry is preserved.'
    exit 0
}
if (!(Test-Path -LiteralPath $scriptPath)) { throw 'Recovery script missing' }
if (!(Test-Path -LiteralPath $pwshPath)) { throw 'Windows PowerShell missing' }
if (!(Test-Path -LiteralPath $conhostPath)) { throw 'conhost.exe missing' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $conhostPath -Argument $arguments
# Ten minutes (2026-10-20): the two-minute loop started Windows PowerShell 720 times a day (7-115 s each under load)
# and restarted the gateway 0 times in its first day. Ten keeps every gap under the 15-minute sleep heuristic in overview.cjs.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -Priority 5 -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Checks the local Hermes process without AI calls and uses the official gateway start command only when absent. Existing tip bot startup is preserved.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output 'SYNK recovery task installed: ten-minute checks, current interactive user, no elevation.'
