param(
    [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent | Split-Path -Parent) 'SYNK_원본창고'),
    [string]$EvidenceRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) '.tmp/backup-four-20261018/schedules')
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($BackupRoot)
$repo = Split-Path $PSScriptRoot -Parent
$dailyName = 'SYNK 매일 백업'
$daily = Get-ScheduledTask -TaskName $dailyName -ErrorAction SilentlyContinue
$pythonw = if ($daily) { $daily.Actions[0].Execute } else { (Get-Command pythonw.exe -ErrorAction Stop).Source }
$taskUser = if ($daily) { $daily.Principal.UserId } else { [Security.Principal.WindowsIdentity]::GetCurrent().Name }
$python = Join-Path (Split-Path $pythonw -Parent) 'python.exe'
$node = (Get-Command node -ErrorAction Stop).Source
$configFile = Join-Path $root 'backup-health-config.json'
$components = @(
    # 10-19 유호님 결정: 무거운 렌더·학습과 겹치면 24분을 넘겨 끊겨서 55분(예약 제한 56분)으로 늘림. 겹치는 30분 실행은 IgnoreNew로 건너뜀.
    # 10-20 유호님 결정: 예약 우선순위 7(CPU 보통 아래·I/O 낮음·메모리 2)에서는 CPU가 꽉 찬 동안 같은 일이 중앙값 1.5배·평균 4.2배(나쁠 때 12~19배) 느려 5(보통)로 올림. 나머지 백업은 7 그대로.
    @{ id='onedrive'; taskName='SYNK OneDrive 문서 백업'; receipt='상태/OneDrive/latest.json'; maxAgeHours=2; maxRunHours=0.9167; intervalMinutes=30; taskPriority=5; scope='안전한 MD·소스와 복원 입구'; command=@($node,(Join-Path $PSScriptRoot 'onedrive-backup.cjs')); workingDirectory=$repo },
    @{ id='github'; taskName='SYNK GitHub 커밋 백업'; receipt='github-backup-status.json'; maxAgeHours=6; maxRunHours=0.4; intervalMinutes=120; scope='비공개 커밋의 전용 ref, 공개 미게시 이력의 암호화 보존'; command=@($node,(Join-Path $PSScriptRoot 'GitHub백업.cjs'),'--apply'); workingDirectory=$repo },
    @{ id='server'; taskName=$dailyName; receipt='backup-status.json'; maxAgeHours=36; maxRunHours=6; dailyTime='05:30'; scope='서버·DB 암호화 사본'; command=@($python,'-X','utf8','-B',(Join-Path $root '매일백업.py')); workingDirectory=$root },
    @{ id='media'; taskName='SYNK 미디어 원본 백업'; receipt='media-backup-status.json'; maxAgeHours=36; maxRunHours=12; dailyTime='12:30'; scope='77yuhbs 20TB, 변경된 원본 새 버전 보존'; command=@($python,'-X','utf8','-B',(Join-Path $root '원본백업.py')); workingDirectory=$root },
    @{ id='archive'; taskName='SYNK 기존 Drive 보관 점검'; receipt='archive-audit-status.json'; maxAgeHours=192; maxRunHours=1; weeklyTime='14:00'; scope='unmet23 5TB 기존 보관 원본 무결성 확인'; command=@($python,'-X','utf8','-B',(Join-Path $root '기존보관점검.py')); workingDirectory=$root }
)
$auxiliaryTasks = @(
    @{ id='gitarchive'; component='github'; taskName='SYNK Git 암호문 백업'; maxRunHours=3; scope='Git 변경 직후 암호화 이력·보호 소스의 Drive 전송과 재검증'; command=@($python,'-X','utf8','-B',(Join-Path $root 'Git보관백업.py')); workingDirectory=$root }
)
foreach ($item in $components + $auxiliaryTasks) {
    foreach ($required in @($item.command[0],($item.command | Where-Object { $_ -match '\.(cjs|py)$' }))) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Backup command missing: $required" }
    }
}
foreach ($required in @('backup-health.py','backup-command.py','backup-task-status.ps1','backup-notify.ps1','보존점검.cjs')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $required))) { throw "Backup helper missing: $required" }
}
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
$capture = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$oldConfig = if (Test-Path -LiteralPath $configFile) { Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json } else { $null }
if ($oldConfig) { Copy-Item -LiteralPath $configFile -Destination (Join-Path $EvidenceRoot "config-before-$capture.json") }
$oldWorkspaceCheck = @($oldConfig.additionalChecks | Where-Object { $_.id -eq 'workspace' }) | Select-Object -First 1
$additionalChecks = @(
    @{ id='workspace'; taskName=$dailyName; receipt='workspace-backup-status.json'; maxAgeHours=36; maxRunHours=6; installedAt=if ($oldWorkspaceCheck) { $oldWorkspaceCheck.installedAt } else { [DateTimeOffset]::UtcNow.ToString('o') }; scope='기존 일일 예약의 업무 문서·등록 첨부·조사 서버 상태 수집과 20TB 원격 대조' }
)
$config = @{ schemaVersion=1; installedAt=if ($oldConfig) { $oldConfig.installedAt } else { [DateTimeOffset]::UtcNow.ToString('o') }; updatedAt=[DateTimeOffset]::UtcNow.ToString('o'); components=$components; auxiliaryTasks=$auxiliaryTasks; additionalChecks=$additionalChecks }
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$configFile.$capture.tmp" -Encoding utf8
Move-Item -LiteralPath "$configFile.$capture.tmp" -Destination $configFile -Force
$principal = New-ScheduledTaskPrincipal -UserId $taskUser -LogonType Interactive -RunLevel Limited
foreach ($item in $components + $auxiliaryTasks) {
    $existing = Get-ScheduledTask -TaskName $item.taskName -ErrorAction SilentlyContinue
    if ($existing) { Export-ScheduledTask -TaskName $item.taskName | Set-Content -LiteralPath (Join-Path $EvidenceRoot "$($item.id)-before-$capture.xml") -Encoding utf8 }
    if ($item.id -eq 'server' -and $daily) { continue }
    $action = New-ScheduledTaskAction -Execute $pythonw -Argument "-X utf8 -B `"$(Join-Path $PSScriptRoot 'backup-command.py')`" --config `"$configFile`" --id $($item.id)" -WorkingDirectory $repo
    if ($item.intervalMinutes) {
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(30) -RepetitionInterval (New-TimeSpan -Minutes $item.intervalMinutes)
        $logon = New-ScheduledTaskTrigger -AtLogOn -User $taskUser
        $triggers = @($trigger,$logon)
    } elseif ($item.dailyTime) {
        $triggers = @(New-ScheduledTaskTrigger -Daily -At $item.dailyTime)
    } elseif ($item.weeklyTime) {
        $triggers = @(New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek Sunday -At $item.weeklyTime)
    } else {
        $triggers = @()
    }
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes ($item.maxRunHours*60+1)) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 30) -Priority $(if ($item.taskPriority) { $item.taskPriority } else { 7 })
    $registration = @{ TaskName=$item.taskName; Action=$action; Settings=$settings; Principal=$principal; Description=$item.scope; Force=$true }
    if ($triggers.Count) { $registration.Trigger=$triggers }
    Register-ScheduledTask @registration | Out-Null
}
$monitorName = 'SYNK 백업 상태 확인'
$existing = Get-ScheduledTask -TaskName $monitorName -ErrorAction SilentlyContinue
if ($existing) { Export-ScheduledTask -TaskName $monitorName | Set-Content -LiteralPath (Join-Path $EvidenceRoot "monitor-before-$capture.xml") -Encoding utf8 }
$preservation = New-ScheduledTaskAction -Execute $pythonw -Argument "-X utf8 -B `"$(Join-Path $root '백업상태.py')`" --node `"$node`" --preservation-script `"$(Join-Path $PSScriptRoot '보존점검.cjs')`"" -WorkingDirectory $root
$health = New-ScheduledTaskAction -Execute $pythonw -Argument "-X utf8 -B `"$(Join-Path $PSScriptRoot 'backup-health.py')`" --root `"$root`" --notify" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 15)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $taskUser
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $monitorName -Action @($preservation,$health) -Trigger @($trigger,$logon) -Settings $settings -Principal $principal -Description 'Four-store receipts, disabled/missed schedules, integrity and Windows failure/recovery notifications; no AI.' -Force | Out-Null
$result = @{ registeredAt=[DateTimeOffset]::UtcNow.ToString('o'); backupTasks=@($components | ForEach-Object { $_.taskName }); auxiliaryTasks=@($auxiliaryTasks | ForEach-Object { $_.taskName }); monitorTask=$monitorName; monitorMinutes=15; dailyServerScheduleUnchanged=[bool]$daily; startedByInstaller=$false }
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $EvidenceRoot 'installed.json') -Encoding utf8
$result | ConvertTo-Json -Depth 5
