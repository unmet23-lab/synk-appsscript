#Requires -Version 7
# T5 first measurement (STAGE1_DESIGN.md 4.2 「도우미」 「먼저 잴 것」): with User Account Control on, can a process with
# ordinary rights read a file another program holds without sharing through a link an administrator made to a shadow
# copy, and can restic back it up from there? Run as the ordinary user. It holds a test file without sharing, asks for
# one administrator confirmation, reads and backs up through the link, then the administrator part removes the link and
# the shadow copy it made — only those, by their ID — and the test folder goes. Nothing else on the PC changes.
#   pwsh -NoProfile -File t5-vss-measure.ps1 -Restic <pinned restic.exe> [-Drive D] [-TestRoot <folder on it>] [-Out <evidence folder>] [-DryRun]
# -Drive is the volume copied (C by default). The test file goes under -TestRoot: the temporary folder for C, the
# drive's root otherwise. Nothing is made while that volume has other shadow copies (they could be dropped — see below).
# -DryRun runs the ordinary-user checks that need no administrator (the hold and the refused direct read) only.
param(
  [ValidateSet('user', 'admin')][string]$Role = 'user',
  [string]$Restic,
  [string]$Out,
  [switch]$DryRun,
  [ValidatePattern('^[A-Za-z]$')][string]$Drive = 'C',
  [string]$TestRoot,
  # The administrator part's inputs come on its command line only; it reads no instruction from any file.
  [string]$Work,
  [string]$UserSid,
  [string]$Done,
  [int]$WaitMinutes = 30
)
$ErrorActionPreference = 'Stop'
# The innermost error and its code — PowerShell wraps a .NET call's error in MethodInvocationException.
function Why($record) { $x = $record.Exception; while ($x.InnerException) { $x = $x.InnerException }; '{0} 0x{1:X8} {2}' -f $x.GetType().Name, $x.HResult, $x.Message.Trim() }
$elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($Role -eq 'admin') {
  # The log goes beside the work folder in ProgramData (the user may read it); the administrator writes nowhere the
  # user can write (4.2 — a folder the user can turn into a link would send the administrator's writes elsewhere).
  $log = "$Work.log"
  function Log([string]$message) { "$(Get-Date -Format o) $message" | Add-Content -LiteralPath $log -Encoding utf8 }
  $id = $null; $link = Join-Path $Work "snap-$Drive"; $root = "$($Drive):\"
  try {
    if (-not $elevated) { throw 'the administrator part needs the administrator token' }
    if ($Work -notmatch '^C:\\ProgramData\\SynkWorkBackupT5-[0-9a-f]{12}$') { throw "unexpected work folder $Work" }
    if ($UserSid -notmatch '^S-1-5-21-[0-9-]+$') { throw "unexpected user $UserSid" }
    if (Test-Path -LiteralPath $Work) { throw 'the work folder is already there' }
    Log "start · user $UserSid"
    Log ("shadow storage before: " + ((vssadmin list shadowstorage "/for=$($Drive):" 2>&1) -join ' | '))
    # Administrators and SYSTEM only, the user reads and passes; nothing inherited from ProgramData, where users may create.
    New-Item -ItemType Directory -Path $Work | Out-Null
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
    $none = [System.Security.AccessControl.PropagationFlags]::None
    foreach ($who in 'S-1-5-32-544', 'S-1-5-18') {
      $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($who), 'FullControl', $inherit, $none, 'Allow'))
    }
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($UserSid), 'ReadAndExecute', $inherit, $none, 'Allow'))
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
    Set-Acl -LiteralPath $Work -AclObject $acl
    Log 'work folder made (Administrators · SYSTEM full, the user read and pass)'
    # A new copy made while the disk is busy can make Windows drop every copy of the volume — the second try on 11-15
    # lost that morning's Windows Update restore point that way (volsnap 25). So none is made while the volume has others.
    $volume = (Get-CimInstance -ClassName Win32_Volume -Filter "DriveLetter='$($Drive):'").DeviceID
    if (-not $volume) { throw "no volume $root" }
    $others = @(Get-CimInstance -ClassName Win32_ShadowCopy | Where-Object VolumeName -eq $volume)
    if ($others.Count) { throw "$root already has $($others.Count) shadow copies (restore points or another backup's) — none made, so they are not put at risk" }
    $started = Get-Date
    $made = Invoke-CimMethod -ClassName Win32_ShadowCopy -MethodName Create -Arguments @{ Volume = $root; Context = 'ClientAccessible' }
    $createMs = [int]((Get-Date) - $started).TotalMilliseconds
    if ($made.ReturnValue -ne 0) { throw "Win32_ShadowCopy.Create returned $($made.ReturnValue)" }
    $id = $made.ShadowID
    $shadow = Get-CimInstance -ClassName Win32_ShadowCopy | Where-Object ID -eq $id
    if (-not $shadow) { throw "the shadow copy $id is not listed" }
    Log "shadow copy $id · $($shadow.DeviceObject) · $createMs ms"
    # New-Item refuses a link to a device path (「매개 변수가 틀립니다」, first run 11-15); mklink /d is the documented way.
    $target = $shadow.DeviceObject + '\'
    $said = & cmd.exe /d /c mklink /d $link $target 2>&1
    if ($LASTEXITCODE -ne 0) {
      Log "mklink: $($said -join ' ')"
      [System.IO.Directory]::CreateSymbolicLink($link, $target) | Out-Null; Log "link $link (CreateSymbolicLink)"
    } else { Log "link $link (mklink)" }
    [ordered]@{ shadowId = $id; device = $shadow.DeviceObject; link = $link; createMs = $createMs } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Work 'ready.json') -Encoding utf8
    $until = (Get-Date).AddMinutes($WaitMinutes)
    while (-not (Test-Path -LiteralPath $Done) -and (Get-Date) -lt $until) { Start-Sleep -Seconds 2 }
    Log $(if (Test-Path -LiteralPath $Done) { 'the user part is done' } else { "no word from the user part in $WaitMinutes minutes" })
  } catch { Log "error: $($_.Exception.Message)" }
  finally {
    # Only what this run made, by its ID: the link (not what it points to), the shadow copy, the empty work folder.
    # Tried whether or not it looks there: a link whose copy is gone does not answer Test-Path.
    try { [System.IO.Directory]::Delete($link, $false); Log 'link removed' } catch [System.IO.DirectoryNotFoundException] { } catch { Log "link not removed: $($_.Exception.Message)" }
    try { if ($id) { Get-CimInstance -ClassName Win32_ShadowCopy | Where-Object ID -eq $id | Remove-CimInstance; Log 'shadow copy removed' } } catch { Log "shadow copy not removed: $($_.Exception.Message)" }
    try {
      if (Test-Path -LiteralPath $Work) { Remove-Item -LiteralPath (Join-Path $Work 'ready.json') -ErrorAction SilentlyContinue; [System.IO.Directory]::Delete($Work, $false); Log 'work folder removed' }
    } catch { Log "work folder not removed: $($_.Exception.Message)" }
    Log ("shadow storage after: " + ((vssadmin list shadowstorage "/for=$($Drive):" 2>&1) -join ' | '))
  }
  exit 0
}

# --- the ordinary user ---
if ($elevated) { throw 'Run this as the ordinary user: the measurement is what a process with ordinary rights can read.' }
if (-not $DryRun -and -not ($Restic -and (Test-Path -LiteralPath $Restic))) { throw 'Give -Restic: the pinned restic.exe.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $Out) { $Out = Join-Path $env:LOCALAPPDATA "SynkWorkBackupStage1\evidence\t5-$stamp" }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$result = [ordered]@{ at = (Get-Date).ToString('o'); dryRun = [bool]$DryRun; drive = $Drive }
if (-not $TestRoot) { $TestRoot = if ($Drive -eq 'C') { [System.IO.Path]::GetTempPath() } else { "$($Drive):\" } }
$test = Join-Path $TestRoot "swb-t5-$stamp"
New-Item -ItemType Directory -Path $test | Out-Null
$file = Join-Path (Get-Item -LiteralPath $test).FullName '잠긴 메일 보관함.pst'
if (-not $file.StartsWith("$($Drive):\", [System.StringComparison]::OrdinalIgnoreCase)) { throw "The test file must be on $($Drive): (the shadow copy is of it): $file" }
$content = [byte[]]::new(3MB); [System.Security.Cryptography.RandomNumberGenerator]::Fill($content)
[System.IO.File]::WriteAllBytes($file, $content)
$want = [System.Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($content))
# Held without sharing, as a mail program holds its archive.
$hold = [System.IO.File]::Open($file, 'Open', 'ReadWrite', 'None')
$admin = $null; $work = $null
try {
  try { [System.IO.File]::ReadAllBytes($file) | Out-Null; $result.directRead = 'read (the hold did not work)' }
  catch { $result.directRead = 'refused: ' + (Why $_) }
  if ($DryRun) { $result.note = 'dry run — no administrator part'; return }

  # Not while the PC is busy (docs/현장노트/윈도우_셸.md — the copy can be dropped, with any others): restic starts in
  # under 0.3 s three times running, or nothing is asked.
  $starts = 1..3 | ForEach-Object { [int](Measure-Command { & $Restic version | Out-Null }).TotalMilliseconds }
  $result.resticStartMs = $starts
  if (($starts | Measure-Object -Maximum).Maximum -ge 300) { throw "the PC is busy (restic starts in $($starts -join ', ') ms) — try again when it is quiet" }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $work = 'C:\ProgramData\SynkWorkBackupT5-' + [System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(6)).ToLower()
  $done = Join-Path $test 'done.flag'
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Role admin -Drive $Drive -Work `"$work`" -UserSid $sid -Done `"$done`" -WaitMinutes 30"
  $asked = Get-Date
  $admin = Start-Process -FilePath (Get-Process -Id $PID).Path -Verb RunAs -ArgumentList $arguments -PassThru -WindowStyle Hidden
  $ready = Join-Path $work 'ready.json'
  for ($i = 0; $i -lt 600 -and -not (Test-Path -LiteralPath $ready) -and -not $admin.HasExited; $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Path -LiteralPath $ready)) { throw 'the administrator part did not make the shadow copy (see its log)' }
  $info = Get-Content -LiteralPath $ready -Raw | ConvertFrom-Json
  $result.shadowCreateMs = $info.createMs; $result.secondsToReady = [int]((Get-Date) - $asked).TotalSeconds
  $through = Join-Path $info.link $file.Substring(3)
  $result.pathThrough = $through

  # 1. The held file, read through the link to the copy.
  $started = Get-Date
  try {
    $got = [System.IO.File]::ReadAllBytes($through)
    $result.readThrough = if ([System.Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($got)) -eq $want) { 'same bytes' } else { 'different bytes' }
  } catch { $result.readThrough = 'failed: ' + (Why $_) }
  $result.readMs = [int]((Get-Date) - $started).TotalMilliseconds
  # 2. The copy keeps the file permissions: what this user could not read before, it cannot read through the copy.
  # Every NTFS volume has System Volume Information, which only SYSTEM may list; on C: also the SAM hive.
  try { [System.IO.Directory]::GetFileSystemEntries((Join-Path $info.link 'System Volume Information')) | Out-Null; $result.otherPermissions = 'listed (permissions not kept)' }
  catch { $result.otherPermissions = 'refused: ' + (Why $_) }
  if ($Drive -eq 'C') {
    try { [System.IO.File]::OpenRead((Join-Path $info.link 'Windows\System32\config\SAM')).Dispose(); $result.samThrough = 'read (permissions not kept)' }
    catch { $result.samThrough = 'refused: ' + (Why $_) }
  }
  # 3. The administrator's folder: this user cannot write there.
  try { [System.IO.File]::WriteAllText((Join-Path $work 'x.txt'), 'x'); $result.workFolderWrite = 'written (the folder is not the administrator''s alone)' }
  catch { $result.workFolderWrite = 'refused: ' + (Why $_) }

  # 4. restic with ordinary rights: a fill-like backup through the link into a throwaway local repository.
  $env:RESTIC_PASSWORD = [System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
  $env:RESTIC_CACHE_DIR = Join-Path $test 'cache'
  $repo = Join-Path $test 'repo'
  & $Restic init --repo $repo --quiet 2>&1 | Out-Null
  $started = Get-Date
  $lines = & $Restic backup --repo $repo --json -- $through 2>&1
  $result.resticExit = $LASTEXITCODE; $result.resticMs = [int]((Get-Date) - $started).TotalMilliseconds
  $summary = $lines | Where-Object { $_ -is [string] -and $_.StartsWith('{') } | ForEach-Object { try { $_ | ConvertFrom-Json } catch { } } | Where-Object message_type -eq 'summary' | Select-Object -Last 1
  $result.resticFiles = $summary.files_new; $result.resticErrors = @($lines | Where-Object { $_ -is [string] -and $_ -match '"message_type":"error"' }).Count
  $snapshot = (& $Restic snapshots --repo $repo --json 2>$null | ConvertFrom-Json) | Select-Object -Last 1
  $result.snapshotPaths = $snapshot.paths
  # How restic recorded the folders on the way (the link is one of them), and the file read back the way the app's
  # restores read it — `dump`, one file — not `restic restore`, which also tries to put back the folders' permissions
  # (the administrator's folder is on the way: first D: run, 11-15, 「not found」).
  $result.nodes = @(& $Restic ls --repo $repo --json latest 2>$null | Select-Object -Skip 1 | ForEach-Object { $n = $_ | ConvertFrom-Json; "$($n.type) $($n.path)" })
  $inRepo = '/' + $through.Substring(0, 1) + '/' + $through.Substring(3).Replace('\', '/')
  $dumped = Join-Path $test 'dumped.bin'
  $p = Start-Process -FilePath $Restic -ArgumentList @('dump', '--repo', "`"$repo`"", 'latest', "`"$inRepo`"") -RedirectStandardOutput $dumped -NoNewWindow -Wait -PassThru
  $result.dumpExit = $p.ExitCode
  $result.dumped = if (-not (Test-Path -LiteralPath $dumped)) { 'nothing' } elseif ((Get-FileHash -LiteralPath $dumped -Algorithm SHA256).Hash -eq $want) { 'same bytes' } else { 'different bytes' }
  $back = Join-Path $test 'back'
  $result.restoreSaid = @(& $Restic restore latest --repo $repo --target $back 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 4)
  # -Force: the copy's root comes back hidden and system (first D: run 11-15 — the file was there, the search missed it).
  $restored = Get-ChildItem -LiteralPath $back -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object Name -eq ([System.IO.Path]::GetFileName($file)) | Select-Object -First 1
  $result.restored = if (-not $restored) { 'not found' } elseif ((Get-FileHash -LiteralPath $restored.FullName -Algorithm SHA256).Hash -eq $want) { 'same bytes' } else { 'different bytes' }
} catch { $result.error = $_.Exception.Message }
finally {
  if ($admin) {
    if ($done) { New-Item -ItemType File -Path $done -Force | Out-Null }
    $admin.WaitForExit(180000) | Out-Null
    if ($work) {
      $result.linkGone = -not (Get-Item -LiteralPath (Join-Path $work "snap-$Drive") -Force -ErrorAction SilentlyContinue); $result.workFolderGone = -not (Test-Path -LiteralPath $work)
      if (Test-Path -LiteralPath "$work.log") { $result.adminLog = @(Get-Content -LiteralPath "$work.log") }
    }
  }
  $hold.Dispose()
  # A restore puts back the administrator folder's permissions (this user may only read there); the user owns what it
  # restored, so it resets them first, or the test folder stays (first D: run 11-15).
  if (Test-Path -LiteralPath $test) { & icacls.exe $test /reset /T /C /Q 2>&1 | Out-Null }
  Remove-Item -LiteralPath $test -Recurse -Force -ErrorAction SilentlyContinue
  $result.testFolderGone = -not (Test-Path -LiteralPath $test)
  Remove-Item Env:RESTIC_PASSWORD, Env:RESTIC_CACHE_DIR -ErrorAction SilentlyContinue
  $result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Out 'result.json') -Encoding utf8
  Get-Content -LiteralPath (Join-Path $Out 'result.json')
}
