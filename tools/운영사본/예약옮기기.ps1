<#
예약 작업을 운영 사본으로 옮기기(2026-10-22) — Windows 예약 작업이 공용 작업본(여러 세션이 고치는 곳)의 코드 대신 운영 사본
(tools/운영사본.js, origin/master만 따라감)의 코드를 실행하게 한다. 백업 대상·볼트·백업 작업의 작업 폴더(데이터)는 그대로다.
pwsh 7로 돌린다.

  pwsh -NoProfile -File tools/운영사본/예약옮기기.ps1                    미리 보기(아무것도 바꾸지 않는다)
  pwsh -NoProfile -File tools/운영사본/예약옮기기.ps1 -Apply             작업마다 XML 백업 → 동작의 코드 경로만 바꿈 → 「SYNK 운영 사본 갱신」(5분)
                                                                          등록 → 볼트 설정(backup-health-config.json)의 onedrive·github 도구 경로 두 줄
  pwsh -NoProfile -File tools/운영사본/예약옮기기.ps1 -Restore <백업 폴더>  백업 XML로 다시 등록 · 볼트 설정 되돌림 · 이 스크립트가 만든 갱신 작업 지움 ·
                                                                          운영 사본 가리킴(공용 git 폴더의 synk-ops-path) 지움 · 헤르메스 감시 계약을 공용
                                                                          작업본에서 다시 잡음(install-automation.cjs --여기서 --apply)

백업 폴더: %LOCALAPPDATA%\synk\ops\예약백업\<시각>\(작업별 XML · 볼트 설정 사본 · receipt.json).
작업 폴더: 코드만 도는 작업(CI 알림·게시 성과·예약큐·팁 적용안·헤르메스 복구)은 운영 사본으로, 백업 작업은 그대로.
「자기 작업」만 바꾼다 — 동작의 인자에 공용 작업본 tools\ 경로가 있는 것. 이미 운영 사본이면 건너뛴다.
#>
param([switch]$Apply, [string]$Restore = '')
$ErrorActionPreference = 'Stop'

$codeRepo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$common = & git -C $codeRepo rev-parse --path-format=absolute --git-common-dir
if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'git 공용 폴더를 못 찾았다' }
$common = [IO.Path]::GetFullPath($common)
$main = Split-Path $common -Parent
$opsFile = Join-Path $common 'synk-ops-path'
$ops = if (Test-Path -LiteralPath $opsFile) { [IO.Path]::GetFullPath((Get-Content -LiteralPath $opsFile -Raw).Trim()) } else { '' }
$config = Join-Path (Join-Path (Split-Path $main -Parent) 'SYNK_원본창고') 'backup-health-config.json'
$updaterName = 'SYNK 운영 사본 갱신'
$utf8 = New-Object System.Text.UTF8Encoding $false

function Write-Atomic([string]$file, [string]$text) {
    $temp = "$file.$PID.tmp"
    [IO.File]::WriteAllText($temp, $text, $utf8)
    Move-Item -LiteralPath $temp -Destination $file -Force
}

if ($Restore) {
    $receipt = Get-Content -LiteralPath (Join-Path $Restore 'receipt.json') -Raw | ConvertFrom-Json
    foreach ($t in @($receipt.tasks)) {
        Register-ScheduledTask -TaskName $t.name -TaskPath $t.path -Xml (Get-Content -LiteralPath (Join-Path $Restore $t.file) -Raw) -Force | Out-Null
        Write-Output "되돌림: $($t.name)"
    }
    if ($receipt.configChanged) {
        Copy-Item -LiteralPath (Join-Path $Restore 'backup-health-config.json') -Destination $config -Force
        Write-Output "되돌림: $config"
    }
    if ($receipt.updaterCreated) {
        Unregister-ScheduledTask -TaskName $updaterName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Output "지움: $updaterName"
    }
    # 가리킴을 두면 바로올리기 push마다 운영 사본을 갱신하고 헤르메스 감시를 다시 운영 사본으로 잡는다 — 지우고 공용 작업본에서 다시 잡는다.
    # 중간에 끊겨도 같은 -Restore를 다시 돌리면 된다(위 단계는 모두 몇 번 해도 같다)
    Remove-Item -LiteralPath $opsFile -Force -ErrorAction SilentlyContinue
    Write-Output "지움: $opsFile$(if ($ops) { "(운영 사본 폴더 $ops 는 그대로 — 필요 없으면 node_modules 연결부터 끊고 지운다)" })"
    & node (Join-Path $main 'tools\hermes-synk\install-automation.cjs') --여기서 --apply | Out-Null
    Write-Output "헤르메스 감시 계약: 공용 작업본에서 다시 잡음(종료 $LASTEXITCODE)"
    exit 0
}

# 여기부터는 운영 사본이 있어야 한다
if (-not $ops -or -not (Test-Path -LiteralPath (Join-Path $ops 'tools\운영사본.js'))) { throw '운영 사본이 없다 — node tools/운영사본.js 만들기 --실행' }
$stateDir = Split-Path $ops -Parent
$mainTools = (Join-Path $main 'tools') + '\'
$opsTools = (Join-Path $ops 'tools') + '\'
# GB4 — 인자의 경로는 대소문자·빗금 꼴이 달라도 같은 곳이다(C:/Users/…/tools/…도 잡는다)
$mainToolsPattern = '(?i)' + ([regex]::Escape($mainTools) -replace '\\\\', '[\\/]')
$codeTasks = @('SYNK CI 빨간불 알림', 'SYNK 게시 성과 판정', 'SYNK 예약큐', 'SYNK 팁 적용안', 'SYNK_Hermes_Gateway_Recovery')
$backupTasks = @('SYNK OneDrive 문서 백업', 'SYNK GitHub 커밋 백업', 'SYNK 미디어 원본 백업', 'SYNK 기존 Drive 보관 점검', 'SYNK Git 암호문 백업', 'SYNK 백업 상태 확인')

# 계획 — 작업마다 지금 동작 → 바꿀 동작
$plan = @()
foreach ($name in $codeTasks + $backupTasks) {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if (-not $task) { $plan += [pscustomobject]@{ name = $name; note = '없음 — 건너뜀' }; continue }
    $actions = @()
    $changed = $false
    foreach ($a in $task.Actions) {
        $arguments = if ($a.Arguments) { [regex]::Replace($a.Arguments, $mainToolsPattern, $opsTools.Replace('$', '$$')) } else { $a.Arguments }
        $folder = if ($name -in $codeTasks -and $a.WorkingDirectory -and [IO.Path]::GetFullPath($a.WorkingDirectory) -eq $main) { $ops } else { $a.WorkingDirectory }
        if ($arguments -ne $a.Arguments -or $folder -ne $a.WorkingDirectory) { $changed = $true }
        $actions += [pscustomobject]@{ Execute = $a.Execute; Before = $a.Arguments; After = $arguments; FolderBefore = $a.WorkingDirectory; FolderAfter = $folder }
    }
    $plan += [pscustomobject]@{ name = $name; path = $task.TaskPath; state = "$($task.State)"; changed = $changed; actions = $actions; note = if ($changed) { '' } else { '이미 운영 사본이거나 공용 작업본 코드 경로가 없음 — 건너뜀' } }
}
$configText = if (Test-Path -LiteralPath $config) { [IO.File]::ReadAllText($config) } else { '' }
$mainEscaped = $mainTools.Replace('\', '\\')
$opsEscaped = $opsTools.Replace('\', '\\')
$configHits = ([regex]::Matches($configText, [regex]::Escape($mainEscaped))).Count
$updater = Get-ScheduledTask -TaskName $updaterName -ErrorAction SilentlyContinue

foreach ($p in $plan) {
    Write-Output "== $($p.name)$(if ($p.state) { " [$($p.state)]" })$(if ($p.note) { " — $($p.note)" })"
    foreach ($a in @($p.actions)) {
        if (-not $p.changed) { continue }
        Write-Output "   전: $($a.Before)$(if ($a.FolderBefore) { "  (작업 폴더 $($a.FolderBefore))" })"
        Write-Output "   뒤: $($a.After)$(if ($a.FolderAfter) { "  (작업 폴더 $($a.FolderAfter))" })"
    }
}
Write-Output "== 볼트 설정 $config — 공용 작업본 tools 경로 $($configHits)줄 → 운영 사본(백업 대상·작업 폴더는 그대로)"
Write-Output "== $updaterName — $(if ($updater) { '이미 있음' } else { '새로 등록: 5분마다 node 운영사본.js 갱신 --실행(AI 없음)' })"
if (-not $Apply) { Write-Output '미리 보기 — -Apply를 붙이면 바꾼다.'; exit 0 }
if ($configHits -notin @(0, 2)) { throw "볼트 설정에서 공용 작업본 tools 경로가 $($configHits)줄이다(기대 2) — 바꾸지 않았다" }

# 백업 → 바꾸기
$backup = Join-Path $stateDir ('예약백업\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$receipt = [ordered]@{ at = (Get-Date).ToString('o'); main = $main; ops = $ops; tasks = @(); configChanged = $false; updaterCreated = $false }
function Save-Receipt { [IO.File]::WriteAllText((Join-Path $backup 'receipt.json'), ($receipt | ConvertTo-Json -Depth 5), $utf8) }
$index = 0
foreach ($p in $plan | Where-Object { $_.changed }) {
    $index++
    $file = "task-$index.xml"
    Export-ScheduledTask -TaskName $p.name -TaskPath $p.path | Set-Content -LiteralPath (Join-Path $backup $file) -Encoding unicode
    $receipt.tasks += [ordered]@{ name = $p.name; path = $p.path; file = $file }
    Save-Receipt
    $newActions = foreach ($a in $p.actions) {
        $split = @{ Execute = $a.Execute }
        if ($a.After) { $split.Argument = $a.After }
        if ($a.FolderAfter) { $split.WorkingDirectory = $a.FolderAfter }
        New-ScheduledTaskAction @split
    }
    Set-ScheduledTask -TaskName $p.name -TaskPath $p.path -Action $newActions | Out-Null
    Write-Output "바꿈: $($p.name)"
}
if ($configHits -eq 2) {
    Copy-Item -LiteralPath $config -Destination (Join-Path $backup 'backup-health-config.json')
    $receipt.configChanged = $true                    # 바꾸기 전에 적는다 — 되돌리기는 사본으로 덮으니 안 바뀌었어도 같다
    Save-Receipt
    Write-Atomic $config $configText.Replace($mainEscaped, $opsEscaped)
    Write-Output "바꿈: $config"
}
if (-not $updater) {
    $pythonw = (Get-ScheduledTask -TaskName 'SYNK 예약큐').Actions[0].Execute
    # 장부 다시 올리기·헤르메스 다시 잡기(cron 고치기 1분 안팎)가 겹치는 바쁜 회차도 끝나게 한도를 15분으로(기본 280초)
    $arguments = '-X utf8 -B "{0}" --한도 900 "{1}" 갱신 --실행' -f (Join-Path $ops 'tools\숨김실행.py'), (Join-Path $ops 'tools\운영사본.js')
    $action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $ops
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
    $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
    $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'SYNK ops copy refresh every 5 minutes. No AI: follows origin/master, pushes leftover records, re-pins the Hermes monitor contract, writes the status file.'
    $receipt.updaterCreated = $true
    Save-Receipt
    Register-ScheduledTask -TaskName $updaterName -InputObject $task | Out-Null
    Write-Output "등록: $updaterName"
}
Save-Receipt
# 바꾼 뒤 다시 읽어 공용 작업본 코드 경로가 남은 작업이 없는지 본다
foreach ($name in $codeTasks + $backupTasks) {
    $left = @((Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue).Actions | Where-Object { $_.Arguments -match $mainToolsPattern })
    if ($left.Count) { Write-Warning "$name 에 공용 작업본 코드 경로가 남았다: $($left[0].Arguments)" }
}
Write-Output "백업: $backup"
Write-Output "되돌리기: pwsh -NoProfile -File `"$(Join-Path $opsTools '운영사본\예약옮기기.ps1')`" -Restore `"$backup`""
