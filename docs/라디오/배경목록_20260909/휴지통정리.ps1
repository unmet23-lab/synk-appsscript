param([switch]$Execute, [switch]$VideoOnly)
$ErrorActionPreference = 'Stop'
$radioTaskRoot = [IO.Path]::GetFullPath('C:/Users/q1212/Documents/SYNK-appsscript')
$radioTaskFolder = [IO.Path]::Combine($radioTaskRoot, 'docs/라디오/배경목록_20260909')
$planName = if ($VideoOnly) { '영상삭제계획.json' } else { '삭제계획.json' }
$reportName = if ($VideoOnly) { '영상삭제결과.json' } else { '삭제결과.json' }
$radioDeletePlan = Get-Content -LiteralPath ([IO.Path]::Combine($radioTaskFolder, $planName)) -Raw | ConvertFrom-Json
$allowedRoots = @('docs/Loom_자산/', 'docs/라디오/', '영상/public/공방/')
$expectedKept = @(1, 2, 11, 13, 17, 29, 28, 27, 21, 16)
if (($radioDeletePlan.keepNumbers -join ',') -ne ($expectedKept -join ',')) { throw 'Selection mismatch' }
if (-not $radioDeletePlan.userApprovedSharedSourceDeletion) { throw 'Missing explicit approval marker' }
$resolved = @()
foreach ($entry in $radioDeletePlan.files) {
  if (-not ($allowedRoots | Where-Object { $entry.path.StartsWith($_, [StringComparison]::Ordinal) })) { throw "Outside allowed asset roots: $($entry.path)" }
  $absolute = [IO.Path]::GetFullPath([IO.Path]::Combine($radioTaskRoot, $entry.path))
  if (-not $absolute.StartsWith($radioTaskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Target escapes repository' }
  $item = Get-Item -LiteralPath $absolute
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not a regular asset file: $absolute" }
  $parent = $item.Directory
  while ($parent.FullName -ne $radioTaskRoot) {
    if (($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $parent.Parent) { throw 'Unsafe ancestor' }
    $parent = $parent.Parent
  }
  if ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Asset changed after review: $absolute" }
  $resolved += [pscustomobject]@{ path = $entry.path; absolute = $absolute; sha256 = $entry.sha256; bytes = $entry.bytes }
}
if (($resolved.absolute | Select-Object -Unique).Count -ne $resolved.Count) { throw 'Duplicate deletion target' }
foreach ($protected in $radioDeletePlan.protected) {
  $absolute = [IO.Path]::GetFullPath([IO.Path]::Combine($radioTaskRoot, $protected.path))
  if ($resolved.absolute -contains $absolute) { throw 'Protected target collision' }
  if ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $protected.sha256) { throw "Protected asset changed: $($protected.path)" }
}
if (-not $Execute) {
  [pscustomobject]@{ mode = 'validated-only'; files = $resolved.Count; bytes = ($resolved | Measure-Object bytes -Sum).Sum; protected = $radioDeletePlan.protected.Count } | ConvertTo-Json
  exit 0
}
Add-Type -AssemblyName Microsoft.VisualBasic
$completed = [Collections.Generic.List[object]]::new()
try {
  foreach ($entry in $resolved) {
    # SendToRecycleBin never intentionally performs a permanent delete.
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($entry.absolute,
      [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
      [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,
      [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
    if (Test-Path -LiteralPath $entry.absolute) { throw "File remains: $($entry.path)" }
    $completed.Add($entry)
  }
  foreach ($protected in $radioDeletePlan.protected) {
    $absolute = [IO.Path]::Combine($radioTaskRoot, $protected.path)
    if ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $protected.sha256) { throw "Protected asset changed: $($protected.path)" }
  }
} finally {
  $report = [pscustomobject]@{ method = 'Windows Recycle Bin'; recoverable = $true; planned = $resolved.Count; removed = $completed.Count; completed = ($completed.Count -eq $resolved.Count); files = $completed }
  [IO.File]::WriteAllText([IO.Path]::Combine($radioTaskFolder, $reportName), ($report | ConvertTo-Json -Depth 7), [Text.UTF8Encoding]::new($false))
}
[pscustomobject]@{ removed = $completed.Count; method = 'Windows Recycle Bin'; protectedHashesUnchanged = $radioDeletePlan.protected.Count } | ConvertTo-Json
