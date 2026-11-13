# The machine-wide installer, end to end, on a clean Windows runner (STAGE1_DESIGN.md 4.2 「컴퓨터 전체 설치」 · 4.11).
# PowerShell 7. The runner's administrator installs silently; checks the files against the build receipt, the install
# folder's permission, the uninstall entry, the Start menu shortcut and its notification identity, no desktop shortcut,
# the run-task folder's owner and permission; a standard user registers its four runs there the way the app does
# (schedule_probe --keep), cannot run the machine setup or change the folder's permission, and a run of theirs ends at
# once while the installer's marker is there, and so does the window app; installing again closes a running process from
# the installed files or, when it cannot (a SYSTEM task's), stops before anything changed, stops at a file something
# else holds and puts the executables back, and keeps those runs; the uninstaller removes every
# user's runs, the folder, the shortcut, the entries and the files, and keeps user state. Then once more with the
# run-task folder made first by the standard user: left to them, and the runs go to the root folder. Synthetic only —
# no secret, no backup. Never run it on a person's PC: it installs, uninstalls and adds a local user.
param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Receipt,
  [Parameter(Mandatory = $true)][string]$Probe,
  [Parameter(Mandatory = $true)][string]$Work
)
$ErrorActionPreference = 'Stop'
$product = 'SYNK 업무 백업'
$identity = 'im.synk.workbackup'
$dir = Join-Path $env:ProgramFiles $product
$runExe = Join-Path $dir 'WorkBackupRun.exe'
$folderPath = '\SYNK 업무 백업'
$uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$product"
$locationKey = "HKLM:\SOFTWARE\SYNK\$product"
$startMenu = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\$product.lnk"
$commonDesktop = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) "$product.lnk"
New-Item -ItemType Directory -Force -Path $Work | Out-Null
$script:bad = @()
function Expect($ok, [string]$what) { if ($ok) { "ok: $what" } else { $script:bad += $what; "MISMATCH: $what" } }
function Run([string]$file, [string[]]$arguments) { (Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru -NoNewWindow).ExitCode }
function Service() { $s = New-Object -ComObject Schedule.Service; $s.Connect(); $s }
function FolderExists() { try { $null = (Service).GetFolder($folderPath); $true } catch { $false } }
function RunTasks() {
  # Every task in the product folder and the root whose action starts this install's run executable.
  $service = Service
  $found = @()
  foreach ($path in @($folderPath, '\')) {
    try { $folder = $service.GetFolder($path); $tasks = @($folder.GetTasks(1)) } catch { Write-Host "(cannot list $path)"; continue }
    foreach ($task in $tasks) {
      if (([xml]$task.Xml).Task.Actions.Exec.Command -eq $runExe) { $found += "$path|$($task.Name)" }
    }
  }
  $found
}
# A small PowerShell script run as the standard user; its output comes back as text.
function AsUser([string]$name, [string]$body) {
  $file = Join-Path $Work "$name.ps1"; $out = Join-Path $Work "$name.out"
  Set-Content -LiteralPath $file -Value $body -Encoding utf8
  $p = Start-Process -FilePath (Get-Command pwsh).Source -ArgumentList @('-NoProfile', '-File', "`"$file`"") -Credential $credential -LoadUserProfile `
    -WorkingDirectory $Work -RedirectStandardOutput $out -Wait -PassThru
  "$($p.ExitCode)|$((Get-Content -LiteralPath $out -Raw) -replace '\s+$', '')"
}

# 0. A standard user (step 5 has them make the run-task folder before an install).
$password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(18)) + 'aA1!'
$secure = ConvertTo-SecureString $password -AsPlainText -Force
New-LocalUser -Name 'swbinst' -Password $secure -AccountNeverExpires -PasswordNeverExpires | Out-Null
$credential = New-Object System.Management.Automation.PSCredential('swbinst', $secure)
icacls $Work /grant 'swbinst:(OI)(CI)M' | Out-Null

# 1. Install (silent) and what it leaves.
Expect ((Run $Setup @('/S')) -eq 0) 'silent install exits 0'
$built = Get-Content -LiteralPath $Receipt -Raw | ConvertFrom-Json
Expect ((Get-FileHash -LiteralPath (Join-Path $dir 'WorkBackup.exe')).Hash -eq $built.exeSha256.ToUpperInvariant()) 'WorkBackup.exe is the built one'
Expect ((Get-FileHash -LiteralPath $runExe).Hash -eq $built.runExeSha256.ToUpperInvariant()) 'WorkBackupRun.exe is the built one'
$manifestPath = Join-Path $dir 'resources\manifest.json'
Expect ((Get-FileHash -LiteralPath $manifestPath).Hash -eq $built.resourceManifestSha256.ToUpperInvariant()) 'resources/manifest.json is the staged one'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$wrong = @($manifest.files.PSObject.Properties | Where-Object {
  $file = Join-Path $dir ('resources\' + $_.Name.Replace('/', '\'))
  -not (Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file).Hash -ne $_.Value.sha256.ToUpperInvariant()
})
Expect ($wrong.Count -eq 0) "every staged resource is installed unchanged ($(@($manifest.files.PSObject.Properties).Count) files, $($wrong.Count) wrong)"
Expect (-not (Test-Path -LiteralPath (Join-Path $dir '.installing'))) 'the installing marker is gone after the install'
# Only administrators, SYSTEM and TrustedInstaller may change the installed files (the helper relies on it, 4.2 「도우미」).
# Write data · append · extended attributes · attributes · delete · change permission · take ownership, and generic write · all.
$writeRights = 0x500D0116
$writers = @((Get-Acl -LiteralPath $dir).Access | Where-Object {
  $_.AccessControlType -eq 'Allow' -and ([int64]$_.FileSystemRights -band $writeRights) -and
  @('BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM', 'NT SERVICE\TrustedInstaller', 'CREATOR OWNER') -notcontains $_.IdentityReference.Value
} | ForEach-Object { "$($_.IdentityReference)=$($_.FileSystemRights)" })
Expect ($writers.Count -eq 0) "nobody else may write the install folder ($($writers -join ', '))"
$entry = Get-ItemProperty -LiteralPath $uninstallKey -ErrorAction SilentlyContinue
Expect ($entry.DisplayName -eq $product -and $entry.DisplayVersion -eq $built.version) "uninstall entry $($entry.DisplayName) $($entry.DisplayVersion)"
Expect (Test-Path -LiteralPath $startMenu) 'Start menu shortcut'
$shell = New-Object -ComObject Shell.Application
$aumid = $shell.Namespace((Split-Path -Parent $startMenu)).ParseName((Split-Path -Leaf $startMenu)).ExtendedProperty('System.AppUserModel.ID')
if (-not $aumid -and (Get-Command Get-StartApps -ErrorAction SilentlyContinue)) { $aumid = @(Get-StartApps | Where-Object { $_.Name -eq $product })[0].AppID }
Expect ($aumid -eq $identity) "the shortcut carries the notification identity ($aumid)"
Expect (-not (Test-Path -LiteralPath $commonDesktop)) 'no desktop shortcut'
Expect (FolderExists) 'run-task folder made by the installer'
# What the installer's own --install left, read before anything here runs it again: the installer only logs a
# failed --install, so a rerun first would mend the folder and hide that failure (re-review c GA1).
$security = (Service).GetFolder($folderPath).GetSecurityDescriptor(5)
"run-task folder owner and permission: $security"
Expect ($security -match '^O:(BA|SY|S-1-5-32-544|S-1-5-18)(G:|D:)') 'administrators own the folder'
# The folder's own entry for signed-in users (empty flags — the root's inherited one does not count).
Expect ($security -match '\(A;;[^;]+;;;AU\)') 'signed-in users may add their own tasks to the folder'
Expect ($security -notmatch 'S-1-5-21-[\d-]+\)') 'no single account keeps its own entry'
# Then once more by hand: --install on a folder that is already there succeeds and leaves it the same.
$setupOut = Join-Path $Work 'admin-install.json'
$q = Start-Process -FilePath $runExe -ArgumentList '--install' -RedirectStandardOutput $setupOut -Wait -PassThru -NoNewWindow
Expect ($q.ExitCode -eq 0 -and (Get-Content -LiteralPath $setupOut -Raw | ConvertFrom-Json).ok -eq $true) "--install as the administrator succeeds again ($(Get-Content -LiteralPath $setupOut -Raw))"
Expect ((Service).GetFolder($folderPath).GetSecurityDescriptor(5) -eq $security) 'running --install again leaves the folder as it was'

# 2. The standard user: registers its four runs the way the app does, cannot run the machine setup or change the
#    folder's permission, and a run of theirs ends at once while the installer's marker is there.
$registered = Join-Path $Work 'user-register.json'
$p = Start-Process -FilePath $Probe -ArgumentList @("`"$runExe`"", "`"$registered`"", '--keep') -Credential $credential -LoadUserProfile -WorkingDirectory $Work -Wait -PassThru
$r = Get-Content -LiteralPath $registered -Raw | ConvertFrom-Json
Expect ($p.ExitCode -eq 0 -and $r.register.ok -eq $true -and $r.register.folder -eq $folderPath -and -not $r.elevated) "standard user registered its runs in the folder ($($r.register | ConvertTo-Json -Compress))"
foreach ($mode in '--install', '--uninstall') {
  $out = Join-Path $Work "user$mode.json"
  $q = Start-Process -FilePath $runExe -ArgumentList $mode -Credential $credential -LoadUserProfile -WorkingDirectory $Work -RedirectStandardOutput $out -Wait -PassThru
  Expect ($q.ExitCode -eq 77) "a standard user's $mode is refused (exit $($q.ExitCode): $(Get-Content -LiteralPath $out -Raw))"
}
$change = AsUser 'user-folder-acl' @"
`$s = New-Object -ComObject Schedule.Service; `$s.Connect()
`$me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
try { `$s.GetFolder('\SYNK 업무 백업').SetSecurityDescriptor("D:(A;;FA;;;`$me)", 0); 'changed' } catch { 'refused' }
"@
Expect ($change -match '\|refused$') "the standard user cannot change the folder's permission ($change)"
$profileDir = (Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $r.sid }).LocalPath
$userState = Join-Path $profileDir 'AppData\Roaming\SynkWorkBackup'
Set-Content -LiteralPath (Join-Path $dir '.installing') -Value ''
$clock = [Diagnostics.Stopwatch]::StartNew()
$q = Start-Process -FilePath $runExe -ArgumentList @('--run', 'manual') -Credential $credential -LoadUserProfile -WorkingDirectory $Work -Wait -PassThru
$clock.Stop()
# The window app, too, ends before it makes its state folder or lock (Fable 5.2 design review 8). Started from the user's own
# script so it can be waited for and, if it did not end, closed.
$appCheck = AsUser 'app-marker' @"
`$p = Start-Process -FilePath '$((Join-Path $dir 'WorkBackup.exe'))' -PassThru
if (`$p.WaitForExit(20000)) { "exit `$(`$p.ExitCode)" } else { `$p.Kill(); 'still running' }
"@
Remove-Item -LiteralPath (Join-Path $dir '.installing')
Expect ($appCheck -match '\|exit 0$' -and -not (Test-Path -LiteralPath (Join-Path $userState 'ui.lock'))) "the window app ends at once while the marker is there and takes no lock ($appCheck)"
Expect ($q.ExitCode -eq 0 -and -not (Test-Path -LiteralPath (Join-Path $userState 'runs.jsonl'))) "a run ends at once while the marker is there (exit $($q.ExitCode), $($clock.ElapsedMilliseconds) ms, nothing recorded)"
$before = @(RunTasks)
Expect ($before.Count -eq 4) "four runs before installing again ($($before.Count))"
# User state the uninstaller must leave alone (as the app keeps it: %APPDATA%\SynkWorkBackup).
$marker = Join-Path $userState 'keep.txt'
New-Item -ItemType Directory -Force -Path $userState | Out-Null
Set-Content -LiteralPath $marker -Value 'user state'

# 3. The same version again installs in place and keeps everyone's runs. Before it, a long-lived process from the installed
#    resources\node.exe stands in for a running backup: the installer either closes it or, if it cannot (here: another
#    user's process), stops before anything changed — no marker left, nothing moved aside, the runs still there
#    (re-review c GA2 · GA3: no failure window may hold the marker). Which of the two happened is written down.
$node = Join-Path $dir 'resources\node.exe'
$holdScript = Join-Path $Work 'hold.js'
Set-Content -LiteralPath $holdScript -Value 'setInterval(() => {}, 1000);'
# Alive by the process list, which needs no handle on another user's process.
function Alive([int]$id) { [bool](Get-Process -Id $id -ErrorAction SilentlyContinue) }
function Gone([int]$id) { for ($i = 0; $i -lt 30 -and (Alive $id); $i++) { Start-Sleep -Seconds 1 }; -not (Alive $id) }
function Hold([switch]$AsTheUser) {
  $options = @{ FilePath = $node; ArgumentList = @("`"$holdScript`""); WorkingDirectory = $Work; WindowStyle = 'Hidden'; PassThru = $true }
  if ($AsTheUser) { $options.Credential = $credential; $options.LoadUserProfile = $true }
  $id = (Start-Process @options).Id
  Start-Sleep -Seconds 2
  # Shown, not returned: the function's only output is the process id.
  Expect (Alive $id) "a process from the installed node.exe is running$(if ($AsTheUser) { ' as the standard user' })" | Out-Host
  $id
}
# The same from a SYSTEM task in the root folder: Restart Manager in the installer is expected not to close it (another
# user in the same session it does close — 11-13), so this is the way to walk the stopping path.
function HoldAsSystem {
  $service = Service
  $d = $service.NewTask(0)
  $a = $d.Actions.Create(0); $a.Path = $node; $a.Arguments = "`"$holdScript`""; $a.WorkingDirectory = $Work
  $d.Settings.DisallowStartIfOnBatteries = $false; $d.Settings.StopIfGoingOnBatteries = $false; $d.Settings.ExecutionTimeLimit = 'PT30M'
  $null = $service.GetFolder('\').RegisterTaskDefinition('SWB hold', $d, 6, 'SYSTEM', $null, 5)
  $null = $service.GetFolder('\').GetTask('SWB hold').Run($null)
  $found = @()
  for ($i = 0; $i -lt 30 -and -not $found.Count; $i++) {
    Start-Sleep -Seconds 1
    $found = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $node -and $_.CommandLine -like '*hold.js*' })
  }
  Expect ($found.Count -eq 1) 'a process from the installed node.exe is running as SYSTEM' | Out-Host
  [int]$found[0].ProcessId
}
function EndSystemHold([int]$id) {
  $service = Service
  try { $service.GetFolder('\').GetTask('SWB hold').Stop(0) } catch { Write-Host "(stopping the hold task: $($_.Exception.Message))" }
  try { $service.GetFolder('\').DeleteTask('SWB hold', 0) } catch { Write-Host "(deleting the hold task: $($_.Exception.Message))" }
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  Expect (Gone $id) 'the SYSTEM process is gone' | Out-Host
}
function Unchanged([string]$what) {
  Expect (-not (Test-Path -LiteralPath (Join-Path $dir '.installing'))) "${what}: no marker is left"
  Expect (@(Get-ChildItem -LiteralPath $dir -Force -Filter '*.old').Count -eq 0) "${what}: nothing is left moved aside"
  Expect ((Test-Path -LiteralPath $runExe) -and (Get-FileHash -LiteralPath $runExe).Hash -eq $built.runExeSha256.ToUpperInvariant() -and
    (Get-FileHash -LiteralPath (Join-Path $dir 'WorkBackup.exe')).Hash -eq $built.exeSha256.ToUpperInvariant()) "${what}: both executables are still in place"
  $still = @(RunTasks)
  Expect ($still.Count -eq 4 -and -not (Compare-Object $before $still)) "${what}: the runs are still there ($($still.Count))"
  Expect ((Get-ItemProperty -LiteralPath $uninstallKey -ErrorAction SilentlyContinue).DisplayName -eq $product) "${what}: still installed"
}
$userHeld = Hold -AsTheUser
$code = Run $Setup @('/S')
if (Gone $userHeld) {
  "the installer closed the standard user's process (exit $code)"
  Expect ($code -eq 0) 'the install that closed another user''s process exits 0'
} else {
  "the installer could not close the standard user's process and stopped (exit $code)"
  Expect ($code -ne 0) 'an install that cannot close a running process stops'
  Unchanged 'after the install stopped by the standard user''s process'
  $null = AsUser 'stop-held' "Stop-Process -Id $userHeld -Force"
  Expect (Gone $userHeld) 'the standard user''s process is gone'
}
$systemHeld = HoldAsSystem
$code = Run $Setup @('/S')
$closesSystem = Gone $systemHeld
if ($closesSystem) {
  "the installer closed the SYSTEM process too (exit $code) — the stopping path was not walked"
  Expect ($code -eq 0) 'the install that closed a SYSTEM process exits 0'
} else {
  "the installer could not close the SYSTEM process and stopped (exit $code)"
  Expect ($code -ne 0) 'an install that cannot close a running process stops'
  Unchanged 'after the install stopped by the SYSTEM process'
}
EndSystemHold $systemHeld
# A file something outside SYNK holds while the template writes it: the silent install stops instead of skipping it
# (AllowSkipFiles off), and the failure callback puts the moved executables back, drops a moved copy whose new file was
# written and takes the marker away at once (Fable 5.2 design review 1 · 3 — the only failure after the executables move).
$held = [IO.File]::Open($manifestPath, 'Open', 'Read', 'None')
try { $code = Run $Setup @('/S') } finally { $held.Close() }
"an install that could not write one file ended with exit $code"
Expect ($code -ne 0) 'an install that cannot write a file stops instead of skipping it'
Unchanged 'after the install stopped at a file it could not write'
$ownHeld = Hold
Expect ((Run $Setup @('/S')) -eq 0) 'second silent install exits 0'
Expect (Gone $ownHeld) 'the installer closed the running process from its files'
# The executables were moved aside and replaced, not overwritten; nothing of that or of the marker is left.
$aside = @(Get-ChildItem -LiteralPath $dir -Force -Filter '*.old') + @(Get-ChildItem -LiteralPath $dir -Force -Filter '.installing')
Expect ($aside.Count -eq 0) "nothing moved aside or marked is left ($(@($aside | ForEach-Object Name) -join ', '))"
Expect ((Get-FileHash -LiteralPath $runExe).Hash -eq $built.runExeSha256.ToUpperInvariant() -and (Get-FileHash -LiteralPath (Join-Path $dir 'WorkBackup.exe')).Hash -eq $built.exeSha256.ToUpperInvariant()) 'both executables are the built ones again'
$again = @(RunTasks)
Expect ($again.Count -eq 4 -and -not (Compare-Object $before $again)) "the second install kept the runs ($($again.Count))"

# 4. Uninstall (in place, so this waits for it), then what is gone and what stays. If the installer could not close
#    the SYSTEM process, the uninstaller cannot either: it stops before anything changed (its marker comes after).
$uninstaller = Join-Path $dir 'uninstall.exe'
if (-not $closesSystem) {
  $systemHeld = HoldAsSystem
  Expect ((Run $uninstaller @('/S', "_?=$dir")) -ne 0) 'an uninstall that cannot close a running process stops'
  Unchanged 'after the stopped uninstall'
  Expect (FolderExists) 'after the stopped uninstall: the run-task folder is still there'
  EndSystemHold $systemHeld
}
$ownHeld = Hold
Expect ((Run $uninstaller @('/S', "_?=$dir")) -eq 0) 'silent uninstall exits 0'
Expect (Gone $ownHeld) 'the uninstaller closed the running process from its files'
Expect (@(RunTasks).Count -eq 0) 'every run task of this install is gone, the standard user''s included'
Expect (-not (FolderExists)) 'the run-task folder is gone'
Expect (-not (Test-Path -LiteralPath $startMenu)) 'Start menu shortcut gone'
Expect (-not (Test-Path -LiteralPath $uninstallKey)) 'uninstall entry gone'
Expect (-not (Test-Path -LiteralPath $locationKey)) 'recorded install location gone'
# Run in place, the uninstaller cannot delete itself or its folder; everything else must be gone — empty folders too,
# or a real uninstall (not in place) could not remove the install folder at the end (카본 끝판 C2).
$left = @(Get-ChildItem -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.FullName -ne $uninstaller })
Expect ($left.Count -eq 0) "installed files and folders gone ($($left.Count) left: $(@($left | Select-Object -First 5 | ForEach-Object FullName) -join ', '))"
Remove-Item -LiteralPath $dir -Recurse -Force
Expect (Test-Path -LiteralPath $marker) 'user state stays'

# 5. A standard user who makes the run-task folder before the install keeps it: Task Scheduler refuses an administrator
#    every change to a folder a user made (its permission, its owner, deleting it or a task in it — measured 11-13 on
#    this runner image). So the installer leaves it alone and says so, nobody's runs go there (the root folder instead —
#    only a folder Administrators own is used), and the uninstaller removes the runs and leaves that folder to its owner.
$early = AsUser 'user-folder-first' @"
`$s = New-Object -ComObject Schedule.Service; `$s.Connect()
`$me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
try { `$null = `$s.GetFolder('\').CreateFolder('SYNK 업무 백업', "D:(A;;FA;;;`$me)"); 'made' } catch { 'refused' }
"@
Expect ($early -match '\|made$') "a standard user made the run-task folder before an install ($early)"
Expect ((Run $Setup @('/S')) -eq 0) 'a silent install over a folder a standard user made exits 0'
$squatted = (Service).GetFolder($folderPath).GetSecurityDescriptor(5)
Expect ($squatted -notmatch '^O:(BA|SY|S-1-5-32-544|S-1-5-18)(G:|D:)') 'the installer left that folder to the user who made it'
$out = Join-Path $Work 'admin-install-not-ours.json'
$q = Start-Process -FilePath $runExe -ArgumentList '--install' -RedirectStandardOutput $out -Wait -PassThru -NoNewWindow
$said = Get-Content -LiteralPath $out -Raw
Expect ($q.ExitCode -eq 1 -and ($said | ConvertFrom-Json).error -eq 'SCHEDULE_FOLDER_NOT_OURS') "--install says the folder is not the installer's ($said)"
$registered = Join-Path $Work 'user-register-not-ours.json'
$p = Start-Process -FilePath $Probe -ArgumentList @("`"$runExe`"", "`"$registered`"", '--keep') -Credential $credential -LoadUserProfile -WorkingDirectory $Work -Wait -PassThru
$r = Get-Content -LiteralPath $registered -Raw | ConvertFrom-Json
Expect ($p.ExitCode -eq 0 -and $r.register.ok -eq $true -and $r.register.folder -eq '\') "the standard user's runs went to the root folder ($($r.register | ConvertTo-Json -Compress))"
$runs = @(RunTasks)
Expect ($runs.Count -eq 4 -and @($runs | Where-Object { $_ -like "$folderPath|*" }).Count -eq 0) "four runs, none in that folder ($($runs -join ', '))"
Expect ((Run (Join-Path $dir 'uninstall.exe') @('/S', "_?=$dir")) -eq 0) 'the silent uninstall exits 0'
Expect (@(RunTasks).Count -eq 0) 'the runs are gone'
Expect ((FolderExists) -and (Service).GetFolder($folderPath).GetSecurityDescriptor(5) -eq $squatted) 'the folder is left to its owner as it was'
Remove-Item -LiteralPath $dir -Recurse -Force
if ($script:bad.Count) { throw "installer expectations not met: $($script:bad.Count)" }
'installer expectations: all met'
