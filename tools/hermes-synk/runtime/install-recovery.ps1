[CmdletBinding()]
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$taskName = 'SYNK_Hermes_Gateway_Recovery'
$scriptPath = Join-Path $PSScriptRoot 'recover-gateway.ps1'
# Windows PowerShell defaults to the Restricted policy; bypass it for this one script only.
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $scriptPath
$previousArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}"' -f $scriptPath
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    $owned = @($existing.Actions).Count -eq 1 -and
        $existing.Actions[0].Arguments -in @($arguments, $previousArguments)
    if (!$owned) { throw 'A different task already uses this name. Refusing to modify it.' }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
    Write-Output 'SYNK recovery task removed. The original Hermes startup entry is preserved.'
    exit 0
}
if (!(Test-Path -LiteralPath $scriptPath)) { throw 'Recovery script missing' }
# Use the Windows PowerShell that ships with Windows. Installing from the Codex app shell resolved
# pwsh.exe to the Codex runtime, tying this task to that app (2026-10-19).
$pwshPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (!(Test-Path -LiteralPath $pwshPath)) { throw 'Windows PowerShell missing' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pwshPath -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Checks the local Hermes process without AI calls and uses the official gateway start command only when absent. Existing tip bot startup is preserved.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output 'SYNK recovery task installed: two-minute checks, current interactive user, no elevation.'
