param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$config = [IO.File]::ReadAllText($ConfigPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$rows = foreach ($item in @($config.components) + @($config.auxiliaryTasks | Where-Object { $null -ne $_ }) + @($config.additionalChecks | Where-Object { $null -ne $_ })) {
    $task = Get-ScheduledTask -TaskName $item.taskName -ErrorAction SilentlyContinue
    if (-not $task) { @{ id=$item.id; exists=$false }; continue }
    $info = Get-ScheduledTaskInfo -TaskName $item.taskName
    @{
        id=$item.id; exists=$true; enabled=[bool]$task.Settings.Enabled
        state=$task.State.ToString(); result=[long]$info.LastTaskResult
        lastRunAt=if ($info.LastRunTime.Year -gt 2000) { ([DateTimeOffset]$info.LastRunTime).ToUniversalTime().ToString('o') } else { $null }
        nextRunAt=if ($info.NextRunTime.Year -gt 2000) { ([DateTimeOffset]$info.NextRunTime).ToUniversalTime().ToString('o') } else { $null }
    }
}
ConvertTo-Json -InputObject @($rows) -Depth 4 -Compress
