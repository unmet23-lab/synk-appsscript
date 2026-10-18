[CmdletBinding()]
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$taskName = 'SYNK_Hermes_Gateway_Recovery'
$scriptPath = Join-Path $PSScriptRoot 'recover-gateway.ps1'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    $owned = @($existing.Actions).Count -eq 1 -and
        $existing.Actions[0].Arguments -eq ('-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}"' -f $scriptPath)
    if (!$owned) { throw 'A different task already uses this name. Refusing to modify it.' }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
    Write-Output 'SYNK recovery task removed. The original Hermes startup entry is preserved.'
    exit 0
}
if (!(Test-Path -LiteralPath $scriptPath)) { throw 'Recovery script missing' }
$pwshPath = (Get-Command pwsh.exe).Source
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pwshPath -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}"' -f $scriptPath)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Checks the local Hermes process without AI calls and uses the official gateway start command only when absent. Existing tip bot startup is preserved.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output 'SYNK recovery task installed: two-minute checks, current interactive user, no elevation.'
