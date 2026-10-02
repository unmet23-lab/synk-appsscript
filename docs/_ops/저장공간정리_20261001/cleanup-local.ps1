$ErrorActionPreference = 'Stop'
$taskOut = $PSScriptRoot
$taskPlan = Get-Content -LiteralPath (Join-Path $taskOut 'local-cleanup-plan.json') -Raw | ConvertFrom-Json
$taskVideoRoot = [IO.Path]::GetFullPath('C:\Users\q1212\Videos') + '\'
$taskArchive = [IO.Path]::GetFullPath('C:\Users\q1212\Documents\PC_공간정리_20260930\Videos_추가백업_20260930.zip')
$taskBefore = (Get-PSDrive C).Free
$taskLog = [Collections.Generic.List[object]]::new()
foreach ($taskRow in $taskPlan) {
    $taskTarget = [IO.Path]::GetFullPath($taskRow.localPath)
    if (-not ($taskTarget.StartsWith($taskVideoRoot, [StringComparison]::OrdinalIgnoreCase) -or $taskTarget.Equals($taskArchive, [StringComparison]::OrdinalIgnoreCase))) { throw "Target outside verified roots: $taskTarget" }
    if (-not (Test-Path -LiteralPath $taskTarget -PathType Leaf)) { continue }
    $taskFile = Get-Item -LiteralPath $taskTarget -Force
    if ($taskFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse target retained: $taskTarget" }
    if ($taskFile.Length -ne $taskRow.bytes) { throw "Changed file retained: $taskTarget" }
    $taskCurrentHash = (Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($taskCurrentHash -ne $taskRow.sha256) { throw "Changed hash retained: $taskTarget" }
    Remove-Item -LiteralPath $taskTarget -Force
    if (Test-Path -LiteralPath $taskTarget) { throw "Deletion not confirmed: $taskTarget" }
    $taskLog.Add([pscustomobject]@{path=$taskTarget; bytes=$taskRow.bytes; remoteId=$taskRow.remoteId; zipMember=$taskRow.zipMember; sha256=$taskRow.sha256; deleted=$true})
    if ($taskLog.Count % 25 -eq 0) {
        $taskLog | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskOut 'local-deleted.json') -Encoding utf8
        [pscustomobject]@{deletedFiles=$taskLog.Count; currentFreeBytes=(Get-PSDrive C).Free} | ConvertTo-Json -Compress
    }
}
$taskLog | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskOut 'local-deleted.json') -Encoding utf8
$taskAfter = (Get-PSDrive C).Free
$taskResult = [pscustomobject]@{deletedFiles=$taskLog.Count; deletedLogicalBytes=($taskLog | Measure-Object bytes -Sum).Sum; beforeFreeBytes=$taskBefore; afterFreeBytes=$taskAfter; freedBytes=$taskAfter-$taskBefore; checkedAt=(Get-Date).ToString('o')}
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOut 'local-cleanup-result.json') -Encoding utf8
$taskResult | ConvertTo-Json
