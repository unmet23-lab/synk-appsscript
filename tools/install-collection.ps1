[CmdletBinding()]
param()

# 수집 돌리기(tools/수집/돌리기.js)를 30분마다 도는 Windows 예약으로 건다(2026-11-25). 운영 사본에서 실행한다.
# 돌리기는 tools/수집/목록.json에서 때가 된 「수집 예약」만 돌리고, 할 일이 없으면 AI를 부르지 않고 바로 끝난다.
$ErrorActionPreference = 'Stop'
$taskName = 'SYNK 수집'
$scriptFile = Join-Path $PSScriptRoot '수집\돌리기.js'
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$launcher = Join-Path $PSScriptRoot 'run-collection.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
if (!(Test-Path -LiteralPath $scriptFile) -or !(Test-Path -LiteralPath $launcher) -or !(Test-Path -LiteralPath $pythonw)) {
    throw '수집 돌리기 실행기 또는 pythonw.exe를 찾지 못했습니다.'
}

$arguments = '-X utf8 -B "{0}" "{1}" "{2}"' -f $launcher, $nodeExe, $scriptFile
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    $owned = @($existing.Actions).Count -eq 1 -and $existing.Actions[0].Execute -eq $pythonw -and
        $existing.Actions[0].Arguments -like '-X utf8 -B "*\run-collection.py" "*" "*\돌리기.js"'
    if (!$owned) { throw '같은 이름의 다른 작업이 등록되어 있습니다.' }
}
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).Date.AddMinutes(5)) -RepetitionInterval (New-TimeSpan -Minutes 30)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'tools/수집/목록.json에서 때가 된 수집(공모전 찾기 Opus · Sol · Gemini 등)만 돌립니다. 할 일이 없으면 AI 없이 바로 끝납니다.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force:$([bool]$existing) | Out-Null
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object TaskName, NextRunTime
