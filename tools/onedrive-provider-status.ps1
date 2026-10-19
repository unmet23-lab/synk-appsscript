#requires -Version 7.0
<#
Scheduled OneDrive provider metadata collector. Run with pwsh, not Windows PowerShell 5.1.
Input: {"oneDriveRoot":"C:/Users/q1212/OneDrive","files":[{"target":"absolute destination","expectedBytes":123}]}
Also accepts {"targets":["absolute destination"]} or a JSON array of absolute destinations.
Example: pwsh -NoProfile -File ./check-copy-target-metadata.ps1 -ManifestPath ./copy-targets.json
Reads only the manifest, explicit target metadata, ancestor link metadata, and Windows Shell status.
No recursive enumeration, content reads, hashes, hydration requests, sync commands, or UI actions.
The only write is a NEW evidence JSON at the explicit OutputPath. Existing evidence is never overwritten.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ManifestPath,
  [string]$OutputPath,
  [string]$OneDriveRoot
)
$ErrorActionPreference = 'Stop'
$started = Get-Date
$manifestFile = [IO.Path]::GetFullPath($ManifestPath)
$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 100 -NoEnumerate
if (!$OneDriveRoot) { $OneDriveRoot = $manifest.oneDriveRoot }
if (!$OneDriveRoot) { $OneDriveRoot = $env:OneDrive }
if (!$OneDriveRoot -or ![IO.Path]::IsPathFullyQualified($OneDriveRoot)) { throw 'An absolute OneDriveRoot is required.' }
$root = [IO.Path]::GetFullPath($OneDriveRoot).TrimEnd([char[]]@('\','/'))
if (!(Test-Path -LiteralPath $root -PathType Container)) { throw 'OneDriveRoot does not exist.' }
$knownRoots = @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial) | Where-Object { $_ } | ForEach-Object { [IO.Path]::GetFullPath($_).TrimEnd([char[]]@('\','/')) }
if (!($knownRoots | Where-Object { [string]::Equals($_, $root, [StringComparison]::OrdinalIgnoreCase) })) { throw 'OneDriveRoot must match a configured OneDrive environment path.' }
if (!$OutputPath) { $OutputPath = Join-Path $PSScriptRoot ('metadata-status-' + $started.ToString('yyyyMMdd-HHmmssfff') + '.json') }
$outputFile = [IO.Path]::GetFullPath($OutputPath)
$null = New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($outputFile)) -Force
if (Test-Path -LiteralPath $outputFile) { throw 'Output already exists; choose a new evidence filename.' }
if ($manifest -is [array]) { $entries = @($manifest) }
elseif ($null -ne $manifest.files) { $entries = @($manifest.files) }
elseif ($null -ne $manifest.targets) { $entries = @($manifest.targets) }
else { throw 'Manifest must contain files or targets, or be a JSON array.' }
if (!$entries.Count) { throw 'Manifest target list is empty.' }

$rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
$seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$duplicates = [Collections.Generic.List[string]]::new()
$targets = [Collections.Generic.List[object]]::new()
foreach ($entry in $entries) {
  $target = if ($entry -is [string]) { $entry } else { $entry.target }
  if (!$target -or ![IO.Path]::IsPathFullyQualified($target)) { throw 'Every target must be an absolute path.' }
  $target = [IO.Path]::GetFullPath($target)
  if (!$target.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'A target escapes the configured OneDrive root.' }
  if (!$seen.Add($target)) { $duplicates.Add($target); continue }
  $expected = $null
  if ($entry -isnot [string] -and $null -ne $entry.expectedBytes) {
    $expected = [long]$entry.expectedBytes
    if ($expected -lt 0) { throw 'expectedBytes must not be negative.' }
  }
  $targets.Add([pscustomobject]@{ target=$target; expectedBytes=$expected })
}

$stateNames = @{0='NONE';1='SPARSE';2='IN_SYNC';3='PINNED';4='PENDING_UPLOAD';5='PENDING_DOWNLOAD';6='TRANSFERRING';7='ERROR';8='WARNING';9='EXCLUDED';10='PENDING_UNSPECIFIED'}
$shell = New-Object -ComObject Shell.Application
$folders = @{}
$ancestorLinks = @{}
$rows = [Collections.Generic.List[object]]::new()
function Read-MetadataItem([string]$LiteralPath) {
  try { return Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop }
  catch {
    if ($_.CategoryInfo.Category -eq [Management.Automation.ErrorCategory]::ObjectNotFound) { return $null }
    throw
  }
}
foreach ($target in $targets) {
  $row = [ordered]@{ target=$target.target; expectedBytes=$target.expectedBytes; exists=$false; bytes=$null; sizeMatches=$null; attributes=$null; modifiedAt=$null; storageProviderState=$null; stateName='UNAVAILABLE'; syncTransferStatus=$null; error=$null }
  try {
    # Checking metadata does not require following an actual junction/symlink.
    for ($ancestor = [IO.Path]::GetDirectoryName($target.target); $ancestor.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or [string]::Equals($ancestor,$root,[StringComparison]::OrdinalIgnoreCase); $ancestor=[IO.Path]::GetDirectoryName($ancestor)) {
      if (!$ancestorLinks.ContainsKey($ancestor)) {
        $item = Read-MetadataItem $ancestor
        $ancestorLinks[$ancestor] = $null -ne $item -and !!$item.LinkType
      }
      if ($ancestorLinks[$ancestor]) { throw 'junction-or-symlink-ancestor' }
      if ([string]::Equals($ancestor,$root,[StringComparison]::OrdinalIgnoreCase)) { break }
    }
    $file = Read-MetadataItem $target.target
    if ($null -eq $file) { $row.stateName='MISSING' }
    elseif ($file.PSIsContainer) { $row.error='not-a-file' }
    elseif ($file.LinkType) { $row.error='junction-or-symlink' }
    else {
      $row.exists=$true; $row.bytes=[long]$file.Length; $row.attributes=[int]$file.Attributes; $row.modifiedAt=$file.LastWriteTime.ToString('o')
      if ($null -ne $target.expectedBytes) { $row.sizeMatches=($row.bytes -eq $target.expectedBytes) }
      if (!$folders.ContainsKey($file.DirectoryName)) { $folders[$file.DirectoryName]=$shell.Namespace($file.DirectoryName) }
      $item = $folders[$file.DirectoryName].ParseName($file.Name)
      if ($null -eq $item) { throw 'shell-item-unavailable' }
      $state=$item.ExtendedProperty('System.StorageProviderState')
      $row.storageProviderState=$state
      $row.stateName=if ($null -eq $state) {'UNKNOWN'} elseif ($stateNames.ContainsKey([int]$state)) {$stateNames[[int]$state]} else {'UNKNOWN_' + $state}
      $row.syncTransferStatus=$item.ExtendedProperty('System.SyncTransferStatus')
    }
  } catch { $row.error=$_.Exception.Message }
  $rows.Add([pscustomobject]$row)
}
$counts = [ordered]@{}
foreach ($row in $rows) { if (!$counts.Contains($row.stateName)) {$counts[$row.stateName]=0}; $counts[$row.stateName]++ }
$report = [ordered]@{
  schemaVersion=1; startedAt=$started.ToString('o'); finishedAt=(Get-Date).ToString('o'); manifest=$manifestFile; oneDriveRoot=$root
  inputTargets=$entries.Count; uniqueTargets=$targets.Count; duplicateTargets=$duplicates.ToArray(); inspected=$rows.Count
  existingFiles=@($rows | Where-Object exists).Count; missingFiles=@($rows | Where-Object stateName -eq 'MISSING').Count
  sizeMismatches=@($rows | Where-Object { $null -ne $_.sizeMatches -and !$_.sizeMatches }).Count
  readErrors=@($rows | Where-Object error).Count; stateCounts=$counts
  allTargetsStateInSync=($rows.Count -gt 0 -and @($rows | Where-Object { $_.stateName -ne 'IN_SYNC' -or $_.error -or ($null -ne $_.sizeMatches -and !$_.sizeMatches) }).Count -eq 0)
  cloudCompletionClaim=$false; targetContentsRead=$false; hydrationRequested=$false; recursiveEnumeration=$false
  note='Local Windows provider metadata only. IN_SYNC is a provider report, not an independent remote checksum proof. PINNED is reported separately.'
  files=$rows.ToArray()
}
$json=$report | ConvertTo-Json -Depth 7
$stream=[IO.File]::Open($outputFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try { $data=[Text.UTF8Encoding]::new($false).GetBytes($json); $stream.Write($data,0,$data.Length) } finally { $stream.Dispose() }
[pscustomobject]@{ output=$outputFile; inspected=$report.inspected; existing=$report.existingFiles; missing=$report.missingFiles; sizeMismatches=$report.sizeMismatches; readErrors=$report.readErrors; stateCounts=$counts; allTargetsStateInSync=$report.allTargetsStateInSync } | ConvertTo-Json -Depth 4 -Compress

