# Runner 1 of the clean-Windows exercise (STAGE1_DESIGN.md 4.11 · T6 · T12). PowerShell 7, the runner's administrator.
# Installs silently, then for two people on this PC — the administrator and a standard user — makes synthetic data D0
# (test-support/clean-data.cjs), sets up a local profile through the installed app's own worker (clean-app.cjs stands
# in for the window), and lets the installed WorkBackupRun.exe back it up: a first backup, a run while a changed file
# is held open by another program (a partial backup — the standard user has no helper, so it stays partial), and a
# run after it is let go. For the administrator a scheduled run is also started from Task Scheduler. Leaves in
# -Carry, for runner 2: each repository, each data's hash list, each recovery kit sealed with the CI seed.
# Today's 0.7.0 engine backs up to a local folder only from here: its cloud profiles take `work-backup/<id>` in a
# bucket, which the CI test key (prefix ci/) may not write. The real-B2 branch comes with the provisioning server.
# Synthetic only. Never run it on a person's PC: it installs and adds a local user.
param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Probe,
  [Parameter(Mandatory = $true)][string]$Work,
  [Parameter(Mandatory = $true)][string]$Carry,
  [int]$DataMB = 100
)
$ErrorActionPreference = 'Stop'
$product = 'SYNK 업무 백업'
$dir = Join-Path $env:ProgramFiles $product
$runExe = Join-Path $dir 'WorkBackupRun.exe'
$node = Join-Path $dir 'resources\node.exe'
New-Item -ItemType Directory -Force -Path $Work, $Carry | Out-Null
$script:bad = @()
$script:results = [ordered]@{}
function Expect($ok, [string]$what) { if ($ok) { "ok: $what" } else { $script:bad += $what; "MISMATCH: $what" } }
function Service() { $s = New-Object -ComObject Schedule.Service; $s.Connect(); $s }
function LastRun([string]$state) { $lines = @(Get-Content -LiteralPath (Join-Path $state 'runs.jsonl') -ErrorAction SilentlyContinue); if ($lines.Count) { $lines[-1] | ConvertFrom-Json } }
function RunCount([string]$state) { @(Get-Content -LiteralPath (Join-Path $state 'runs.jsonl') -ErrorAction SilentlyContinue).Count }
function Short($run) { if ($run) { "outcome $($run.outcome), $($run.ms) ms, local: $($run.profiles.local | ConvertTo-Json -Compress -Depth 3)" } else { 'no run recorded' } }
# A file held open by another program with no sharing, the way Outlook holds its mail file.
function Hold([string]$file) { [IO.File]::Open($file, 'Open', 'ReadWrite', 'None') }
function Change([string]$file) { $s = [IO.File]::Open($file, 'Open', 'ReadWrite', 'ReadWrite'); $s.Seek(0, 'End') | Out-Null; $s.Write([byte[]](1..64), 0, 64); $s.Close() }

# The tools the standard user runs, in a folder they may read.
$tools = Join-Path $Work 'tools'
# Recovery kits in a folder of their own: the worker refuses to save one where it would hold the data or the
# repository (the window's 「복구 키 저장」 rule), and $Work holds both.
$kits = Join-Path $Work 'kits'
New-Item -ItemType Directory -Force -Path $tools, $kits | Out-Null
foreach ($name in 'clean-app.cjs', 'clean-data.cjs', 'run-setup.cjs', 'clean-user.ps1') { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $tools }

# 0. The standard user, and the install.
$password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(18)) + 'aA1!'
$secure = ConvertTo-SecureString $password -AsPlainText -Force
New-LocalUser -Name 'swbclean' -Password $secure -AccountNeverExpires -PasswordNeverExpires | Out-Null
$credential = New-Object System.Management.Automation.PSCredential('swbclean', $secure)
icacls $Work /grant 'swbclean:(OI)(CI)M' | Out-Null
$clock = [Diagnostics.Stopwatch]::StartNew()
Expect ((Start-Process -FilePath $Setup -ArgumentList '/S' -Wait -PassThru -NoNewWindow).ExitCode -eq 0) 'silent install exits 0'
$script:results['installSeconds'] = [math]::Round($clock.Elapsed.TotalSeconds, 1)

# 1. The administrator.
$adminState = Join-Path $env:APPDATA 'SynkWorkBackup'
$data = Join-Path $Work 'admin-data'
$made = & node (Join-Path $tools 'clean-data.cjs') make $data $DataMB
$script:results['adminData'] = $made | ConvertFrom-Json
$setup = & node (Join-Path $tools 'clean-app.cjs') setup $data (Join-Path $Work 'admin-repo') (Join-Path $kits 'admin-kit.json')
Expect ($LASTEXITCODE -eq 0) "the administrator's local profile set up through the installed worker ($setup)"
function AdminRun([string]$name) {
  $c = [Diagnostics.Stopwatch]::StartNew()
  $code = (Start-Process -FilePath $runExe -ArgumentList '--run', 'manual' -Wait -PassThru -NoNewWindow).ExitCode
  $run = LastRun $adminState
  $script:results[$name] = [ordered]@{ exit = $code; seconds = [math]::Round($c.Elapsed.TotalSeconds, 1); outcome = $run.outcome; local = $run.profiles.local; job = $run.job }
  [pscustomobject]@{ Code = $code; Run = $run }
}
$r = AdminRun 'adminFirst'
Expect ($r.Code -eq 0 -and $r.Run.outcome -eq 'complete' -and $r.Run.profiles.local.newSnapshot -eq $true) "first backup by the installed run executable ($(Short $r.Run))"
$locked = Join-Path $data '잠글 문서\계약서.docx'
Change $locked
$held = Hold $locked
$r = AdminRun 'adminHeld'
$held.Close()
Expect ($r.Code -eq 0 -and $r.Run.outcome -eq 'partial' -and $r.Run.profiles.local.unreadable -ge 1) "a changed file held open: a partial backup, the rest kept ($(Short $r.Run))"
$r = AdminRun 'adminAfter'
Expect ($r.Code -eq 0 -and $r.Run.outcome -eq 'complete') "let go: the next run is a complete backup again ($(Short $r.Run))"
# A run started by Task Scheduler as the app registers it (InteractiveToken — only while the person is signed in): the
# runner's administrator is signed in to its desktop session. It is not due (the last run was a minute ago), which is
# enough to show the task starts the executable. Measured here first (4.11 「못 재는 것」); written down either way.
$auto = & node (Join-Path $tools 'clean-app.cjs') automatic on
Expect ($LASTEXITCODE -eq 0) "automatic backup turned on ($auto)"
$p = Start-Process -FilePath $Probe -ArgumentList @("`"$runExe`"", "`"$(Join-Path $Work 'admin-register.json')`"", '--keep') -Wait -PassThru -NoNewWindow
$register = Get-Content -LiteralPath (Join-Path $Work 'admin-register.json') -Raw | ConvertFrom-Json
Expect ($p.ExitCode -eq 0 -and $register.register.ok -eq $true) "the administrator's five tasks registered ($($register.register | ConvertTo-Json -Compress))"
$hourly = @($register.register.tasks | Where-Object { $_ -match '매시간' })[0]
$count = RunCount $adminState
$started = $false
try { $null = (Service).GetFolder($register.register.folder).GetTask($hourly).Run($null); $started = $true } catch { $script:results['taskRunError'] = $_.Exception.Message }
for ($i = 0; $i -lt 120 -and (RunCount $adminState) -le $count; $i++) { Start-Sleep -Seconds 1 }
$run = LastRun $adminState
$script:results['scheduledRun'] = [ordered]@{ started = $started; recorded = (RunCount $adminState) -gt $count; trigger = $run.trigger; outcome = $run.outcome; waitedSeconds = $i }
"note: a run started from Task Scheduler — $($script:results['scheduledRun'] | ConvertTo-Json -Compress)"
& node (Join-Path $tools 'clean-data.cjs') list $data (Join-Path $Carry 'admin-list.json') | Out-Null
Copy-Item -LiteralPath (Join-Path $Work 'admin-repo') -Destination (Join-Path $Carry 'admin-repo') -Recurse
& node (Join-Path $tools 'clean-data.cjs') seal (Join-Path $kits 'admin-kit.json') (Join-Path $Carry 'admin-kit.sealed')
Expect ($LASTEXITCODE -eq 0) 'the administrator recovery kit sealed for runner 2'

# 2. The standard user: no helper, so a held file keeps the backup partial until it is let go (4.2 「표준 사용자」).
function AsUser([string]$name, [string]$body) {
  $file = Join-Path $Work "$name.ps1"; $out = Join-Path $Work "$name.out"
  # This user's own folders first (clean-user.ps1 — the start passes the administrator's environment on).
  Set-Content -LiteralPath $file -Value (". '$(Join-Path $tools 'clean-user.ps1')'`n" + $body) -Encoding utf8
  $p = Start-Process -FilePath (Get-Command pwsh).Source -ArgumentList @('-NoProfile', '-File', "`"$file`"") -Credential $credential -LoadUserProfile `
    -WorkingDirectory $Work -RedirectStandardOutput $out -Wait -PassThru
  [pscustomobject]@{ Code = $p.ExitCode; Out = (Get-Content -LiteralPath $out -Raw -ErrorAction SilentlyContinue) -replace '\s+$', '' }
}
$stdData = Join-Path $Work 'std-data'
$u = AsUser 'std-setup' @"
`$ErrorActionPreference = 'Stop'
`$me = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
'admin=' + `$me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
& '$node' '$(Join-Path $tools 'clean-data.cjs')' make '$stdData' 30
& '$node' '$(Join-Path $tools 'clean-app.cjs')' setup '$stdData' '$(Join-Path $Work 'std-repo')' '$(Join-Path $kits 'std-kit.json')'
if (`$LASTEXITCODE -ne 0) { exit 1 }
'state=' + `$env:APPDATA
"@
$stdState = (($u.Out -split "`r?`n") | Where-Object { $_ -like 'state=*' } | Select-Object -First 1) -replace '^state=', ''
Expect ($u.Code -eq 0 -and $u.Out -match 'admin=False' -and $stdState) "the standard user (not an administrator) set up a local profile ($($u.Out -replace "`r?`n", ' | '))"
$stdState = Join-Path $stdState 'SynkWorkBackup'
function UserRun([string]$name) {
  $c = [Diagnostics.Stopwatch]::StartNew()
  # The run executable has no console, so `&` would not wait for it; Start-Process passes the fixed environment on.
  $code = (AsUser $name "`$p = Start-Process -FilePath '$runExe' -ArgumentList '--run', 'manual' -Wait -PassThru -NoNewWindow`nexit `$p.ExitCode").Code
  $run = LastRun $stdState
  $script:results[$name] = [ordered]@{ exit = $code; seconds = [math]::Round($c.Elapsed.TotalSeconds, 1); outcome = $run.outcome; local = $run.profiles.local; job = $run.job }
  [pscustomobject]@{ Code = $code; Run = $run }
}
$r = UserRun 'stdFirst'
Expect ($r.Code -eq 0 -and $r.Run.outcome -eq 'complete') "the standard user's first backup ($(Short $r.Run))"
$stdLocked = Join-Path $stdData '잠글 문서\계약서.docx'
Change $stdLocked
$held = Hold $stdLocked
$r = UserRun 'stdHeld'
$held.Close()
Expect ($r.Code -eq 0 -and $r.Run.outcome -eq 'partial' -and $r.Run.profiles.local.unreadable -ge 1) "a held file, standard user: partial, no shadow copy to fill it ($(Short $r.Run))"
$r = UserRun 'stdAfter'
Expect ($r.Code -eq 0 -and $r.Run.outcome -eq 'complete') "let go: the standard user's next run is complete ($(Short $r.Run))"
& node (Join-Path $tools 'clean-data.cjs') list $stdData (Join-Path $Carry 'std-list.json') | Out-Null
Copy-Item -LiteralPath (Join-Path $Work 'std-repo') -Destination (Join-Path $Carry 'std-repo') -Recurse
& node (Join-Path $tools 'clean-data.cjs') seal (Join-Path $kits 'std-kit.json') (Join-Path $Carry 'std-kit.sealed')
Expect ($LASTEXITCODE -eq 0) "the standard user's recovery kit sealed for runner 2"

$script:results['mismatches'] = $script:bad
$script:results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Carry 'backup-results.json') -Encoding utf8
if ($script:bad.Count) { throw "backup expectations not met: $($script:bad.Count)" }
'backup expectations: all met'
