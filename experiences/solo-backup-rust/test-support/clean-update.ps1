# The updater, end to end, on a clean Windows runner (STAGE1_DESIGN.md 4.10 · T19). PowerShell 7.
# Three builds of these sources made for this test only — 0.7.0, 0.7.1 and 0.7.2, each with the throwaway operating and
# recovery public keys made in this run, a feed on 127.0.0.1 and plain HTTP allowed (the release build has none of that)
# — and those keys' private halves.
# 0.7.0 is installed silently, the runner's administrator sets up a local profile and registers its four runs, then
# the installed window app checks and installs against feeds this script serves:
#   no feed → a check fails and says so in update.json · the installed version announced → nothing to do · a package
#   whose bytes were changed · one signed with another key · 0.7.0's package announced as 0.7.1 · one signed without a
#   version → each refused (exit 3) with nothing installed · this user's engine lock held → refused (exit 75) ·
#   the real 0.7.1 → installed in place: its files, the four runs and the user state stay, the next check finds nothing ·
#   0.7.2 signed with the recovery key (a third throwaway key, built into all three as the recovery key) → accepted
#   once the operating key's check fails, and installed in place.
# Then the window app's notice for an install that stopped part way, and the uninstaller after the update.
# Synthetic only; the key is thrown away with the runner. Never run it on a person's PC: it installs and uninstalls.
param(
  [Parameter(Mandatory = $true)][string]$SetupA,
  [Parameter(Mandatory = $true)][string]$SetupB,
  [Parameter(Mandatory = $true)][string]$SetupC,
  [Parameter(Mandatory = $true)][string]$ReceiptB,
  [Parameter(Mandatory = $true)][string]$Keys,
  [Parameter(Mandatory = $true)][string]$Tauri,
  [Parameter(Mandatory = $true)][string]$Probe,
  [Parameter(Mandatory = $true)][string]$Work,
  [Parameter(Mandatory = $true)][int]$Port
)
$ErrorActionPreference = 'Stop'
$product = 'SYNK 업무 백업'
$dir = Join-Path $env:ProgramFiles $product
$app = Join-Path $dir 'WorkBackup.exe'
$runExe = Join-Path $dir 'WorkBackupRun.exe'
$folderPath = '\SYNK 업무 백업'
$uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$product"
$state = Join-Path $env:APPDATA 'SynkWorkBackup'
$support = $PSScriptRoot
$feed = Join-Path $Work 'feed'
New-Item -ItemType Directory -Force -Path $Work, $feed, (Join-Path $Work 'kits') | Out-Null
$script:bad = @()
$script:results = [ordered]@{}
function Expect($ok, [string]$what) { if ($ok) { "ok: $what" } else { $script:bad += $what; "MISMATCH: $what" } }
function Run([string]$file, [string[]]$arguments) { (Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru -NoNewWindow).ExitCode }
function Service() { $s = New-Object -ComObject Schedule.Service; $s.Connect(); $s }
function RunTasks() {
  $service = Service; $found = @()
  foreach ($path in @($folderPath, '\')) {
    try { $tasks = @($service.GetFolder($path).GetTasks(1)) } catch { continue }
    foreach ($task in $tasks) { if (([xml]$task.Xml).Task.Actions.Exec.Command -eq $runExe) { $found += "$path|$($task.Name)" } }
  }
  $found
}
function Version() { (Get-ItemProperty -LiteralPath $uninstallKey -ErrorAction SilentlyContinue).DisplayVersion }
# The window app in one of its update modes: its exit code and its one JSON line.
function Update([string]$mode, [string]$name) {
  $out = Join-Path $Work "$name.out"
  $clock = [Diagnostics.Stopwatch]::StartNew()
  # The updater alone: -Wait would also wait for what it starts — the installer, and the app the installer opens again
  # when it is done, which stays open. The handle is read at once so the exit code is kept.
  $p = Start-Process -FilePath $app -ArgumentList $mode -RedirectStandardOutput $out -PassThru -NoNewWindow
  $null = $p.Handle
  if (-not $p.WaitForExit(20 * 60 * 1000)) { $p.Kill(); $p.WaitForExit(); throw "$name did not end in 20 minutes" }
  $text = (Get-Content -LiteralPath $out -Raw -ErrorAction SilentlyContinue) -replace '\s+$', ''
  $script:results[$name] = [ordered]@{ exit = $p.ExitCode; ms = $clock.ElapsedMilliseconds; out = $text }
  [pscustomobject]@{ Code = $p.ExitCode; Lines = @($text -split "`r?`n" | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json }) }
}
function Sign([string]$file, [string]$key, [string]$version) {
  $arguments = @($Tauri, 'signer', 'sign', '-f', $key, '-p', 'clean-test')
  if ($version) { $arguments += @('--app-version', $version) }
  & node @arguments $file | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "signing $file failed" }
  (Get-Content -LiteralPath "$file.sig" -Raw).Trim()
}
function Feed([string]$version, [string]$file, [string]$signature) {
  $entry = @{ signature = $signature; url = "http://127.0.0.1:$Port/$file" }
  @{ version = $version; notes = ''; pub_date = '2026-11-16T00:00:00Z'; platforms = @{ 'windows-x86_64-nsis' = $entry; 'windows-x86_64' = $entry } } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $feed 'workbackup.json') -Encoding utf8
}
function Unchanged([string]$case) {
  Expect ((Version) -eq '0.7.0') "$case — 0.7.0 is still installed ($(Version))"
  Expect (-not (Test-Path -LiteralPath (Join-Path $dir '.installing'))) "$case — no install started (no marker)"
}

# 1. 0.7.0 installed, a local profile set up and its runs registered — what an update must keep.
Expect ((Run $SetupA @('/S')) -eq 0) 'silent install of 0.7.0 exits 0'
Expect ((Version) -eq '0.7.0') "0.7.0 installed ($(Version))"
$data = Join-Path $Work 'data'
& node (Join-Path $support 'clean-data.cjs') make $data 5 | Out-Null
$setup = & node (Join-Path $support 'clean-app.cjs') setup $data (Join-Path $Work 'repo') (Join-Path $Work 'kits\kit.json')
Expect ($LASTEXITCODE -eq 0) "a local profile set up through the installed worker ($setup)"
Expect ((Run $runExe @('--run', 'manual')) -eq 0) 'a first backup by the installed run executable'
$p = Start-Process -FilePath $Probe -ArgumentList @("`"$runExe`"", "`"$(Join-Path $Work 'register.json')`"", '--keep') -Wait -PassThru -NoNewWindow
Expect ($p.ExitCode -eq 0 -and @(RunTasks).Count -eq 4) "four runs registered ($(@(RunTasks) -join ', '))"
Set-Content -LiteralPath (Join-Path $state 'keep.txt') -Value 'user state'
# Every state file but the locks and what the window rewrites when it opens (the installer opens it at the end).
function StateFiles() {
  Get-ChildItem -LiteralPath $state -Recurse -File -Force | Where-Object {
    $_.Name -notmatch '\.lock$|^(progress|update|notify)\.json$|^native-error\.txt$|\.tmp$' -and $_.FullName -notmatch '\\webview\\'
  } | ForEach-Object { [pscustomobject]@{ Path = $_.FullName.Substring($state.Length); Hash = (Get-FileHash -LiteralPath $_.FullName).Hash } }
}
$stateBefore = @(StateFiles)

# 2. The feed server, and the packages: the real 0.7.1 signed for 0.7.1, the same bytes changed, signed with another key,
#    signed without a version, and 0.7.0's package signed for 0.7.0.
$server = Start-Process -FilePath (Get-Command node).Source -ArgumentList @("`"$(Join-Path $support 'clean-feed-server.cjs')`"", "`"$feed`"", $Port) -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
$good = Join-Path $feed 'SynkWorkBackup-0.7.1-setup.exe'
Copy-Item -LiteralPath $SetupB -Destination $good
$goodSig = Sign $good (Join-Path $Keys 'good.key') '0.7.1'
$changed = Join-Path $feed 'changed.exe'
$bytes = [IO.File]::ReadAllBytes($good); $bytes[[int]($bytes.Length / 2)] = $bytes[[int]($bytes.Length / 2)] -bxor 0x5A; [IO.File]::WriteAllBytes($changed, $bytes)
$other = Join-Path $feed 'other.exe'; Copy-Item -LiteralPath $SetupB -Destination $other
$otherSig = Sign $other (Join-Path $Keys 'wrong.key') '0.7.1'
$bare = Join-Path $feed 'bare.exe'; Copy-Item -LiteralPath $SetupB -Destination $bare
$bareSig = Sign $bare (Join-Path $Keys 'good.key') ''
$older = Join-Path $feed 'older.exe'; Copy-Item -LiteralPath $SetupA -Destination $older
$olderSig = Sign $older (Join-Path $Keys 'good.key') '0.7.0'

# 3. Refusals.
$r = Update '--update-check' 'check-no-feed'
$record = Get-Content -LiteralPath (Join-Path $state 'update.json') -Raw | ConvertFrom-Json
Expect ($r.Code -eq 1 -and $r.Lines[-1].error -eq 'UPDATE_FEED' -and $record.error -eq 'UPDATE_FEED' -and $null -eq $record.available -and $record.current -eq '0.7.0') "no feed: the check fails and update.json says so ($($script:results['check-no-feed'].out))"
Feed '0.7.0' 'older.exe' $olderSig
$r = Update '--update-check' 'check-same'
$record = Get-Content -LiteralPath (Join-Path $state 'update.json') -Raw | ConvertFrom-Json
Expect ($r.Code -eq 0 -and $null -eq $record.available -and $null -eq $record.error) "the installed version announced: nothing available ($($script:results['check-same'].out))"
$r = Update '--update-install' 'install-same'
Expect ($r.Code -eq 0 -and $null -eq $r.Lines[-1].result.available) "the installed version announced: install has nothing to do ($($script:results['install-same'].out))"
Unchanged 'the installed version announced'
foreach ($case in @(
    @{ name = 'changed'; what = 'a package whose bytes were changed'; file = 'changed.exe'; sig = $goodSig; version = '0.7.1' },
    @{ name = 'other-key'; what = 'a package signed with another key'; file = 'other.exe'; sig = $otherSig; version = '0.7.1' },
    @{ name = 'no-version'; what = 'a package signed without its version'; file = 'bare.exe'; sig = $bareSig; version = '0.7.1' },
    @{ name = 'older-as-newer'; what = "0.7.0's package announced as 0.7.1"; file = 'older.exe'; sig = $olderSig; version = '0.7.1' })) {
  Feed $case.version $case.file $case.sig
  $r = Update '--update-install' "install-$($case.name)"
  Expect ($r.Code -eq 3 -and $r.Lines[-1].error -eq 'UPDATE_SIGNATURE' -and -not ($r.Lines | Where-Object { $_.installing })) "$($case.what): refused, exit 3 ($($script:results["install-$($case.name)"].out))"
  Start-Sleep -Seconds 3
  Unchanged $case.what
}
# The real package while this user's engine lock is held (a backup or restore of theirs is going): refused, try later.
$goodFeed = & node (Join-Path $support '..\scripts\update-feed.cjs') $good "$good.sig" "http://127.0.0.1:$Port/SynkWorkBackup-0.7.1-setup.exe" (Join-Path $Work 'workbackup.json')
Expect ($LASTEXITCODE -eq 0) "update-feed.cjs makes the feed of the real package ($goodFeed)"
Copy-Item -LiteralPath (Join-Path $Work 'workbackup.json') -Destination (Join-Path $feed 'workbackup.json') -Force
$lock = [IO.File]::Open((Join-Path $state 'engine.lock'), 'OpenOrCreate', 'ReadWrite', 'ReadWrite')
$lock.Lock(0, 1)
$r = Update '--update-install' 'install-busy'
$lock.Unlock(0, 1); $lock.Close()
Expect ($r.Code -eq 75 -and $r.Lines[-1].error -eq 'RUN_ACTIVE') "the engine lock held: refused, exit 75 ($($script:results['install-busy'].out))"
Unchanged 'the engine lock held'

# 4. The real 0.7.1.
$r = Update '--update-check' 'check-newer'
$record = Get-Content -LiteralPath (Join-Path $state 'update.json') -Raw | ConvertFrom-Json
Expect ($r.Code -eq 0 -and $record.available -eq '0.7.1') "0.7.1 announced: the check finds it and update.json says so ($($script:results['check-newer'].out))"
$clock = [Diagnostics.Stopwatch]::StartNew()
$r = Update '--update-install' 'install-newer'
Expect ($r.Code -eq 0 -and ($r.Lines | Where-Object { $_.installing -eq '0.7.1' })) "the real package: signature accepted and the installer started ($($script:results['install-newer'].out))"
# The updater holds the engine lock until the installer's marker is there, so a run cannot start in between (GPT GA2).
Expect ((Test-Path -LiteralPath (Join-Path $dir '.installing')) -or (Version) -eq '0.7.1') 'the updater ended only once the installer had taken over (its marker there)'
# The installer runs on after the app has ended: wait for the new version and the marker gone, steady for 10 seconds.
$steady = 0
while ($clock.Elapsed.TotalMinutes -lt 10 -and $steady -lt 10) {
  Start-Sleep -Seconds 1
  if ((Version) -eq '0.7.1' -and -not (Test-Path -LiteralPath (Join-Path $dir '.installing'))) { $steady++ } else { $steady = 0 }
}
$script:results['updateSeconds'] = [math]::Round($clock.Elapsed.TotalSeconds, 1)
Expect ((Version) -eq '0.7.1') "0.7.1 installed in place ($(Version), $($script:results['updateSeconds']) s)"
$built = Get-Content -LiteralPath $ReceiptB -Raw | ConvertFrom-Json
Expect ((Get-FileHash -LiteralPath $app).Hash -eq $built.exeSha256.ToUpperInvariant()) 'WorkBackup.exe is the 0.7.1 build'
Expect ((Get-FileHash -LiteralPath $runExe).Hash -eq $built.runExeSha256.ToUpperInvariant()) 'WorkBackupRun.exe is the 0.7.1 build'
Expect ((Get-FileHash -LiteralPath (Join-Path $dir 'resources\manifest.json')).Hash -eq $built.resourceManifestSha256.ToUpperInvariant()) 'resources are the 0.7.1 ones'
Expect (-not (Test-Path -LiteralPath (Join-Path $dir 'WorkBackupRun.exe.old')) -and -not (Test-Path -LiteralPath (Join-Path $dir 'WorkBackup.exe.old'))) 'nothing left moved aside'
Expect (@(RunTasks).Count -eq 4) "the four runs stay ($(@(RunTasks) -join ', '))"
Get-Process -Name WorkBackup -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$stateAfter = @(StateFiles)
$lost = @($stateBefore | Where-Object { $b = $_; -not ($stateAfter | Where-Object { $_.Path -eq $b.Path -and $_.Hash -eq $b.Hash }) } | ForEach-Object Path)
Expect ($lost.Count -eq 0) "the user state stays as it was ($($stateBefore.Count) files, changed or gone: $($lost -join ', '))"
Expect ((Run $runExe @('--run', 'manual')) -eq 0) 'the updated run executable backs up the same profile'
$r = Update '--update-check' 'check-after'
Expect ($r.Code -eq 0 -and $null -eq (Get-Content -LiteralPath (Join-Path $state 'update.json') -Raw | ConvertFrom-Json).available) "after the update nothing newer is announced ($($script:results['check-after'].out))"

# 4b. The day the operating key is lost: 0.7.2 signed with the recovery key. The updater's own check (the operating key)
#     refuses it, and the check made again with the recovery key built into the app accepts it (4.10 「열쇠 보관」).
$recovered = Join-Path $feed 'SynkWorkBackup-0.7.2-setup.exe'
Copy-Item -LiteralPath $SetupC -Destination $recovered
Feed '0.7.2' 'SynkWorkBackup-0.7.2-setup.exe' (Sign $recovered (Join-Path $Keys 'recovery.key') '0.7.2')
$clock = [Diagnostics.Stopwatch]::StartNew()
$r = Update '--update-install' 'install-recovery'
Expect ($r.Code -eq 0 -and ($r.Lines | Where-Object { $_.installing -eq '0.7.2' })) "a package signed with the recovery key: accepted ($($script:results['install-recovery'].out))"
$steady = 0
while ($clock.Elapsed.TotalMinutes -lt 10 -and $steady -lt 10) {
  Start-Sleep -Seconds 1
  if ((Version) -eq '0.7.2' -and -not (Test-Path -LiteralPath (Join-Path $dir '.installing'))) { $steady++ } else { $steady = 0 }
}
$script:results['recoverySeconds'] = [math]::Round($clock.Elapsed.TotalSeconds, 1)
Expect ((Version) -eq '0.7.2') "0.7.2 installed in place from the recovery key's package ($(Version), $($script:results['recoverySeconds']) s)"
Expect (@(RunTasks).Count -eq 4) "the four runs stay after the second update ($(@(RunTasks).Count))"
Get-Process -Name WorkBackup -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 5. An install that stopped part way: the run executable only moved aside. The window app says so (it stays on its
#    message until closed) instead of starting.
Rename-Item -LiteralPath $runExe -NewName 'WorkBackupRun.exe.old'
$err = Join-Path $Work 'incomplete.err'
$w = Start-Process -FilePath $app -RedirectStandardError $err -PassThru
for ($i = 0; $i -lt 20 -and -not ((Get-Content -LiteralPath $err -Raw -ErrorAction SilentlyContinue) -match 'INSTALL_INCOMPLETE'); $i++) { Start-Sleep -Milliseconds 500 }
$said = (Get-Content -LiteralPath $err -Raw -ErrorAction SilentlyContinue) -replace '\s+$', ''
Expect ($said -eq 'INSTALL_INCOMPLETE' -and -not $w.HasExited) "the window app says the install did not finish ($said, still showing: $(-not $w.HasExited))"
# The lock file stays on disk after earlier runs; what counts is whether anyone holds it, and whether the window started
# a worker (the installed node.exe) or another copy of itself (카본 끝판 A3).
function Held([string]$file) {
  if (-not (Test-Path -LiteralPath $file)) { return $false }
  $s = [IO.File]::Open($file, 'Open', 'ReadWrite', 'ReadWrite')
  try { $s.Lock(0, 1); $s.Unlock(0, 1); $false } catch { $true } finally { $s.Close() }
}
$workers = @(Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase) })
$others = @(Get-Process -Name WorkBackup -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $w.Id })
$uiHeld = Held (Join-Path $state 'ui.lock')
Expect (-not $uiHeld -and $workers.Count -eq 0 -and $others.Count -eq 0) "and starts nothing else (window lock held: $uiHeld, workers: $($workers.Count), other windows: $($others.Count))"
Stop-Process -Id $w.Id -Force -ErrorAction SilentlyContinue
Rename-Item -LiteralPath (Join-Path $dir 'WorkBackupRun.exe.old') -NewName 'WorkBackupRun.exe'

# 6. The uninstaller of the updated version removes the runs and the files and leaves the user state.
$uninstaller = Join-Path $dir 'uninstall.exe'
Expect ((Run $uninstaller @('/S', "_?=$dir")) -eq 0) 'the silent uninstall of 0.7.1 exits 0'
Expect (@(RunTasks).Count -eq 0) 'the runs are gone after the uninstall'
Expect (-not (Test-Path -LiteralPath $uninstallKey)) 'the uninstall entry is gone'
Expect (-not (Test-Path -LiteralPath (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\$product.lnk"))) 'the Start menu shortcut is gone'
Expect (-not (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Classes\synk-workbackup')) 'the open address is gone'
# Run in place, the uninstaller cannot delete itself; everything else must be gone before this script tidies up (GPT GA3).
$left = @(Get-ChildItem -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.FullName -ne $uninstaller })
Expect ($left.Count -eq 0) "installed files and folders gone ($($left.Count) left: $(@($left | Select-Object -First 5 | ForEach-Object FullName) -join ', '))"
Expect (Test-Path -LiteralPath (Join-Path $state 'keep.txt')) 'user state stays after the uninstall'
Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue

Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
$script:results['requests'] = @(Get-Content -LiteralPath (Join-Path $Work 'feed-requests.log') -ErrorAction SilentlyContinue | ForEach-Object { ($_ -split ' ', 2)[1] })
$script:results['mismatches'] = $script:bad
$script:results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Work 'update-results.json') -Encoding utf8
if ($script:bad.Count) { throw "update expectations not met: $($script:bad.Count)" }
'update expectations: all met'
