[CmdletBinding()]
param()

# 공모 자격 확인을 따로 도는 Windows 예약으로 건다(2026-11-20). 운영 사본에서 실행한다.
# 지도 갱신 회차(09:30 · 15:30 · 21:00)와 겹치지 않게 05:10 · 13:10에 35분씩 돈다. 같은 때 둘이 돌면 늦게 온 쪽이 잠금을 보고 건너뛴다.
$ErrorActionPreference = 'Stop'
$taskName = 'SYNK 공모 자격 확인'
$scriptFile = Join-Path $PSScriptRoot '공모자격.js'
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$launcher = Join-Path $PSScriptRoot 'run-contest-eligibility.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
if (!(Test-Path -LiteralPath $scriptFile) -or !(Test-Path -LiteralPath $launcher) -or !(Test-Path -LiteralPath $pythonw)) {
    throw '공모 자격 확인 실행기 또는 pythonw.exe를 찾지 못했습니다.'
}

$arguments = '-X utf8 -B "{0}" "{1}" "{2}"' -f $launcher, $nodeExe, $scriptFile
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    $owned = @($existing.Actions).Count -eq 1 -and $existing.Actions[0].Execute -eq $pythonw -and
        $existing.Actions[0].Arguments -like '-X utf8 -B "*\run-contest-eligibility.py" "*" "*\공모자격.js"'
    if (!$owned) { throw '같은 이름의 다른 작업이 등록되어 있습니다.' }
}
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $PSScriptRoot
$triggers = @('05:10', '13:10') | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
$task = New-ScheduledTask -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description '공모 지도의 열린 공고에서 응모 자격과 마감 · 운영 조건을 공고 원문으로 확인해 비공개 보관함의 자격 판정에 쌓습니다.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force:$([bool]$existing) | Out-Null
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object TaskName, NextRunTime
