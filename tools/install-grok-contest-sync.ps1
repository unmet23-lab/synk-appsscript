[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'SYNK 공모 지도 갱신'
$scriptFile = Join-Path $PSScriptRoot '공모지도동기화.cjs'
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$conhostExe = Join-Path $env:SystemRoot 'System32\conhost.exe'
if (!(Test-Path -LiteralPath $scriptFile) -or !(Test-Path -LiteralPath $conhostExe)) {
    throw '공모 지도 실행기 또는 conhost.exe를 찾지 못했습니다.'
}

$arguments = '--headless "{0}" "{1}"' -f $nodeExe, $scriptFile
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and (@($existing.Actions).Count -ne 1 -or $existing.Actions[0].Arguments -ne $arguments)) {
    throw '같은 이름의 다른 작업이 등록되어 있습니다.'
}
$action = New-ScheduledTaskAction -Execute $conhostExe -Argument $arguments -WorkingDirectory $PSScriptRoot
$triggers = @('09:20', '15:20', '21:00') | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$task = New-ScheduledTask -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description '비공개 그록 공모전 수집본을 읽어 검증한 후보와 근거를 이 PC의 공모 지도에 반영합니다.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force:$([bool]$existing) | Out-Null
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object TaskName, NextRunTime
