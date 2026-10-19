param(
    [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent | Split-Path -Parent) 'SYNK_원본창고'),
    [string]$EvidenceRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) '.tmp/automation-six-20261017/preservation')
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath (Join-Path $BackupRoot 'backup-health-config.json')) {
    # Preserve the four-store monitor when an older setup command is used again.
    & (Join-Path $PSScriptRoot 'install-four-backups.ps1') -BackupRoot $BackupRoot -EvidenceRoot $EvidenceRoot
    return
}
$backupTask = Get-ScheduledTask -TaskName 'SYNK 매일 백업'
$sourceInfo = Get-ScheduledTaskInfo -TaskName $backupTask.TaskName
$root = [IO.Path]::GetFullPath($BackupRoot)
$script = Join-Path $root '백업상태.py'
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Backup monitor script missing' }
$pythonw = $backupTask.Actions[0].Execute
if (-not (Test-Path -LiteralPath $pythonw -PathType Leaf)) { throw 'Existing backup Python interpreter missing' }
$name = 'SYNK 백업 상태 확인'
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
$existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
$capture = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
if ($existing) {
    Export-ScheduledTask -TaskName $name | Set-Content -LiteralPath (Join-Path $EvidenceRoot "monitor-before-$capture.xml") -Encoding utf8
}
Export-ScheduledTask -TaskName $backupTask.TaskName | Set-Content -LiteralPath (Join-Path $EvidenceRoot "daily-backup-unchanged-$capture.xml") -Encoding utf8
$configFile = Join-Path $root 'backup-monitor-config.json'
if (-not (Test-Path -LiteralPath $configFile)) {
    if ($sourceInfo.NextRunTime.Year -lt 2026) { throw 'Existing daily backup next run is unavailable' }
    $config = @{
        schemaVersion = 1
        installedAt = [DateTimeOffset]::UtcNow.ToString('o')
        firstExpectedAt = ([DateTimeOffset]$sourceInfo.NextRunTime).ToUniversalTime().ToString('o')
        scheduleTimeZone = 'Asia/Seoul'
        scheduleTime = '05:30'
        graceHours = 6
    }
    $tempFile = "$configFile.$capture.tmp"
    $config | ConvertTo-Json | Set-Content -LiteralPath $tempFile -Encoding utf8
    Move-Item -LiteralPath $tempFile -Destination $configFile
}
$action = New-ScheduledTaskAction -Execute $pythonw -Argument "-X utf8 `"$script`" --monitor" -WorkingDirectory $root
$repository = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node -ErrorAction Stop).Source
$preservationScript = Join-Path $PSScriptRoot '보존점검.cjs'
$preservation = New-ScheduledTaskAction -Execute $pythonw -Argument "-X utf8 `"$script`" --node `"$node`" --preservation-script `"$preservationScript`"" -WorkingDirectory $root
$recurring = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $backupTask.Principal.UserId
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $backupTask.Principal.UserId -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action @($action, $preservation) -Trigger @($recurring, $logon) -Settings $settings -Principal $principal -Description 'Local backup receipt/freshness and preservation check. No AI, cloud request, transfer or deletion.' -Force | Out-Null
Start-ScheduledTask -TaskName $name
$result = @{
    taskName = $name
    backupTaskUnchanged = $true
    intervalMinutes = 30
    preservationRefresh = 'ledger changed or 24 hours elapsed'
    preservationHashLimitBytes = 4294967296
    atLogon = $true
    wakeToRun = $false
    networkCalls = 0
    externalMessages = 0
    registeredAt = [DateTimeOffset]::UtcNow.ToString('o')
}
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidenceRoot 'monitor-install.json') -Encoding utf8
$result | ConvertTo-Json
