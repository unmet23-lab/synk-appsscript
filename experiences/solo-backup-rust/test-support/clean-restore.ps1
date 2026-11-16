# Runner 2 of the clean-Windows exercise (STAGE1_DESIGN.md 4.11 · T12): a fresh Windows that never saw the backups.
# Installs silently, opens the recovery kits runner 1 sealed, and restores each repository with the installed app's own
# worker the way 「복구 키로 연결」 · 「최신 백업 복구」 do (clean-app.cjs stands in for the window): the administrator's
# backup as this runner's administrator, the standard user's as a new standard user here. Every file's size and SHA-256
# and every folder must come back as runner 1 listed them. Until 「옮겨 오기」 (4.6) lands, this restores into a new
# folder — not the original places. PowerShell 7. Synthetic only. Never run it on a person's PC.
param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Carry,
  [Parameter(Mandatory = $true)][string]$Work
)
$ErrorActionPreference = 'Stop'
$product = 'SYNK 업무 백업'
$dir = Join-Path $env:ProgramFiles $product
$node = Join-Path $dir 'resources\node.exe'
New-Item -ItemType Directory -Force -Path $Work | Out-Null
$script:bad = @()
$script:results = [ordered]@{}
function Expect($ok, [string]$what) { if ($ok) { "ok: $what" } else { $script:bad += $what; "MISMATCH: $what" } }
$tools = Join-Path $Work 'tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null
foreach ($name in 'clean-app.cjs', 'clean-data.cjs', 'run-setup.cjs', 'clean-user.ps1') { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $tools }

Expect ((Start-Process -FilePath $Setup -ArgumentList '/S' -Wait -PassThru -NoNewWindow).ExitCode -eq 0) 'silent install on a fresh runner exits 0'
Expect (-not (Test-Path -LiteralPath (Join-Path $env:APPDATA 'SynkWorkBackup'))) 'no state here before the restore'
$kits = Join-Path $Work 'kits'
New-Item -ItemType Directory -Force -Path $kits | Out-Null
foreach ($who in 'admin', 'std') {
  & node (Join-Path $tools 'clean-data.cjs') open (Join-Path $Carry "$who-kit.sealed") (Join-Path $kits "$who-kit.json")
  Expect ($LASTEXITCODE -eq 0) "$who recovery kit opened with the CI seed"
}
function Repository([string]$who) { @(Get-ChildItem -LiteralPath (Join-Path $Carry "$who-repo") -Directory)[0].FullName }
function Restored([string]$line) { ($line -split "`r?`n" | Where-Object { $_ -like '{*' } | Select-Object -Last 1 | ConvertFrom-Json) }

# 1. The administrator's backup, restored by this runner's administrator.
$clock = [Diagnostics.Stopwatch]::StartNew()
$out = & node (Join-Path $tools 'clean-app.cjs') restore (Join-Path $kits 'admin-kit.json') (Repository 'admin') (Join-Path $Work 'admin-out')
$seconds = [math]::Round($clock.Elapsed.TotalSeconds, 1)
$r = Restored ($out -join "`n")
Expect ($LASTEXITCODE -eq 0 -and $r.ok -and $r.restored) "the administrator's backup restored from its recovery kit ($seconds s)"
if ($r.restored) {
  $compare = & node (Join-Path $tools 'clean-data.cjs') compare (Join-Path $Carry 'admin-list.json') (Join-Path $r.restored '01-admin-data')
  $script:results['admin'] = [ordered]@{ seconds = $seconds; compare = ($compare | ConvertFrom-Json) }
  Expect ($LASTEXITCODE -eq 0) "every file and folder came back unchanged ($compare)"
  Expect (Test-Path -LiteralPath (Join-Path $r.restored '복구경로.json')) 'the restore says where each folder came from (복구경로.json)'
}

# 2. The standard user's backup, restored by a new standard user here.
$password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(18)) + 'aA1!'
$secure = ConvertTo-SecureString $password -AsPlainText -Force
New-LocalUser -Name 'swbnew' -Password $secure -AccountNeverExpires -PasswordNeverExpires | Out-Null
$credential = New-Object System.Management.Automation.PSCredential('swbnew', $secure)
icacls $Work /grant 'swbnew:(OI)(CI)M' | Out-Null
# restic writes its lock beside a local repository even to read it.
icacls $Carry /grant 'swbnew:(OI)(CI)M' | Out-Null
$script = Join-Path $Work 'std-restore.ps1'; $log = Join-Path $Work 'std-restore.out'
Set-Content -LiteralPath $script -Encoding utf8 -Value @"
. '$(Join-Path $tools 'clean-user.ps1')'
& '$node' '$(Join-Path $tools 'clean-app.cjs')' restore '$(Join-Path $kits 'std-kit.json')' '$(Repository 'std')' '$(Join-Path $Work 'std-out')'
exit `$LASTEXITCODE
"@
$clock = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath (Get-Command pwsh).Source -ArgumentList @('-NoProfile', '-File', "`"$script`"") -Credential $credential -LoadUserProfile -WorkingDirectory $Work -RedirectStandardOutput $log -Wait -PassThru
$seconds = [math]::Round($clock.Elapsed.TotalSeconds, 1)
$r = Restored (Get-Content -LiteralPath $log -Raw)
Expect ($p.ExitCode -eq 0 -and $r.ok -and $r.restored) "the standard user's backup restored by a new standard user ($seconds s)"
if ($r.restored) {
  $compare = & node (Join-Path $tools 'clean-data.cjs') compare (Join-Path $Carry 'std-list.json') (Join-Path $r.restored '01-std-data')
  $script:results['std'] = [ordered]@{ seconds = $seconds; compare = ($compare | ConvertFrom-Json) }
  Expect ($LASTEXITCODE -eq 0) "every file and folder came back unchanged ($compare)"
}
Remove-Item -LiteralPath $kits -Recurse -Force
$script:results['mismatches'] = $script:bad
$script:results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Work 'restore-results.json') -Encoding utf8
if ($script:bad.Count) { throw "restore expectations not met: $($script:bad.Count)" }
'restore expectations: all met'
