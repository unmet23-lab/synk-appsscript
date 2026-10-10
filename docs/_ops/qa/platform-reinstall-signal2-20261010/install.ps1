$ErrorActionPreference = 'Stop'
# 싱ㅋ 시그널 2 Platform 재설치(이 PC). 10-10 install-platform-v2.ps1과 같은 절차:
# 실행 중이면 거절(앱을 끄지 않음) → 프로그램 폴더 전체 백업·대조 → NSIS /S → 76개 payload·파일 목록·등록·바로가기 확인 → 영수증.
$qa = $PSScriptRoot
$root = [IO.Path]::GetFullPath((Join-Path $qa '../../../..'))
$program = Join-Path $env:LOCALAPPDATA 'Programs\SYNKPlatformPreview'
$installer = Join-Path $root 'desktop/artifacts/platform-reinstall-signal2-20261010/SYNK Platform Preview-0.4.0-win-x64.exe'
$installerSha = '8c5630161f451d46a99c1d0c5f715a931b9875ec3968c1ec887db94c73fc7634'
$baselineAsar = 'c715de9ed040dc974127ef95ba6d629ed574a47a3c104b0b10a5182849f200a5'
$receiptPath = Join-Path $qa 'installed-platform.json'
$backupParent = [IO.Path]::GetFullPath((Join-Path $root '.tmp/platform-reinstall-signal2-20261010'))
$backup = Join-Path $backupParent 'installed-program-backup'
$guid = 'c4ee183e-8850-55ce-9d7f-a3a1acb8c830'
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid"
$appKey = "HKCU:\Software\$guid"
$checks = [System.Collections.Generic.List[object]]::new()
$closure = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTime]::UtcNow.ToString('o')
$proc = $null; $exitCode = $null; $err = $null; $invoked = $false; $complete = $false; $backupComplete = $false
$registryBefore = $null; $registryAfter = $null; $shortcuts = $null
function Get-Sha($p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Check($name, $ok) { $checks.Add([ordered]@{name=$name;ok=[bool]$ok}); if (!$ok) { throw ('Check failed: '+$name) } }
function Read-Registry {
    $u = Get-ItemProperty -LiteralPath $uninstallKey -ErrorAction SilentlyContinue
    $a = Get-ItemProperty -LiteralPath $appKey -ErrorAction SilentlyContinue
    [ordered]@{uninstallKeyExists=[bool]$u;displayName=$u.DisplayName;displayVersion=$u.DisplayVersion;installLocation=$u.InstallLocation;uninstallString=$u.UninstallString;appKeyExists=[bool]$a;appInstallLocation=$a.InstallLocation}
}
function Assert-Closed {
    $names = @('SYNKPlatformPreview.exe','SYNKMessengerPreview.exe','SYNKWorldPreview.exe')
    $folders = @('SYNKPlatformPreview','SYNKMessengerPreview','SYNKWorldPreview') | ForEach-Object { Join-Path $env:LOCALAPPDATA ('Programs\'+$_+'\') }
    $blocked = @()
    foreach ($p in Get-CimInstance Win32_Process) {
        $inFolder = $false
        if ($p.ExecutablePath) { foreach ($f in $folders) { if ($p.ExecutablePath.StartsWith($f,[StringComparison]::OrdinalIgnoreCase)) { $inFolder = $true } } }
        if ($p.Name -in $names -or $inFolder) { $blocked += [ordered]@{pid=$p.ProcessId;name=$p.Name} }
    }
    $closure.Add([ordered]@{checkedAt=[DateTime]::UtcNow.ToString('o');closed=($blocked.Count -eq 0);blocked=$blocked})
    if ($blocked.Count -gt 0) { throw 'A SYNK program is running. No app is terminated; installation is refused.' }
}
if (Test-Path -LiteralPath $receiptPath) { throw 'Preserve the previous installation receipt.' }
try {
    $payload = Get-Content -LiteralPath (Join-Path $qa 'payload-manifest.json') -Raw | ConvertFrom-Json
    Check 'payload-has-76-files' (@($payload.files).Count -eq 76)
    $verification = Get-Content -LiteralPath (Join-Path $qa 'verification.json') -Raw | ConvertFrom-Json
    Check 'static-verification-ok' ($verification.ok -eq $true -and $verification.installer.sha256 -eq $installerSha)
    Assert-Closed
    Check 'installer-pin' ((Get-Sha $installer) -eq $installerSha)
    Check 'installed-baseline-is-signal2-install' ((Get-Sha (Join-Path $program 'resources\app.asar')) -eq $baselineAsar)
    $registryBefore = Read-Registry
    Check 'free-space-at-least-2GB' ((Get-PSDrive -Name C).Free -ge 2000000000)
    Check 'no-program-reparse-points' (@(Get-ChildItem -LiteralPath $program -Force -Recurse -Attributes ReparsePoint).Count -eq 0)
    Check 'backup-inside-ignored-tmp' ($backup.StartsWith($backupParent+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))
    Check 'backup-does-not-exist' (!(Test-Path -LiteralPath $backup))
    Copy-Item -LiteralPath $program -Destination $backup -Recurse -Force
    $before = @(Get-ChildItem -LiteralPath $program -Recurse -Force -File)
    Check 'full-program-backup' (@($before | Where-Object {
        $rel = [IO.Path]::GetRelativePath($program,$_.FullName); $saved = Join-Path $backup $rel
        !(Test-Path -LiteralPath $saved -PathType Leaf) -or (Get-Sha $saved) -ne (Get-Sha $_.FullName)
    }).Count -eq 0)
    $backupComplete = $true
    Check 'post-backup-space-at-least-1.3GB' ((Get-PSDrive -Name C).Free -ge 1300000000)
    Assert-Closed
    $proc = Start-Process -FilePath $installer -ArgumentList @('/S') -WindowStyle Hidden -PassThru
    $invoked = $true
    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    while (!$proc.WaitForExit(1000)) { if ([DateTime]::UtcNow -ge $deadline) { throw 'Installer exceeded 180 seconds. Preserve its PID and the backup; do not terminate or retry.' } }
    $exitCode = $proc.ExitCode
    Check 'nsis-exit0' ($exitCode -eq 0)
    foreach ($f in $payload.files) {
        $dest = [IO.Path]::GetFullPath((Join-Path $program $f.path))
        Check ('payload-'+$f.path) ($dest.StartsWith($program+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $dest -PathType Leaf) -and (Get-Item -LiteralPath $dest).Length -eq $f.bytes -and (Get-Sha $dest) -eq $f.sha256)
    }
    $actualSet = @(Get-ChildItem -LiteralPath $program -Recurse -Force -File | ForEach-Object { [IO.Path]::GetRelativePath($program,$_.FullName).Replace([char]92,[char]47) } | Sort-Object)
    $expectedSet = @(@($payload.files.path) + 'Uninstall SYNKPlatformPreview.exe' | Sort-Object)
    Check 'entire-installed-file-set' (@(Compare-Object $actualSet $expectedSet).Count -eq 0)
    Check 'no-installed-reparse-points' (@(Get-ChildItem -LiteralPath $program -Force -Recurse -Attributes ReparsePoint).Count -eq 0)
    $registryAfter = Read-Registry
    Check 'registry-uninstall-entry' ($registryAfter.uninstallKeyExists -and $registryAfter.displayVersion -eq '0.4.0' -and $registryAfter.displayName -like 'SYNK Platform Preview*' -and [IO.Path]::GetFullPath($registryAfter.installLocation).TrimEnd([char]92) -eq $program -and $registryAfter.uninstallString -like '*\Uninstall SYNKPlatformPreview.exe*/currentuser*')
    Check 'registry-app-install-location' ($registryAfter.appKeyExists -and [IO.Path]::GetFullPath($registryAfter.appInstallLocation).TrimEnd([char]92) -eq $program)
    $shell = New-Object -ComObject WScript.Shell
    $start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\SYNK Platform Preview.lnk'
    $startTarget = if (Test-Path -LiteralPath $start) { $shell.CreateShortcut($start).TargetPath } else { $null }
    $shortcuts = [ordered]@{startMenu=$start;startMenuTarget=$startTarget}
    Check 'start-menu-shortcut-targets-installed-exe' ($startTarget -and [IO.Path]::GetFullPath($startTarget) -eq (Join-Path $program 'SYNKPlatformPreview.exe'))
    Check 'app-not-auto-launched' (@(Get-CimInstance Win32_Process -Filter "Name='SYNKPlatformPreview.exe'").Count -eq 0)
    $complete = $true
} catch {
    $err = $_.Exception.Message
} finally {
    [ordered]@{
        startedAt=$startedAt;completedAt=[DateTime]::UtcNow.ToString('o');installed=$complete
        installer=$installer;installerSHA256=$installerSha;installerExecuted=$invoked;installerPID=if($proc){$proc.Id}else{$null};exitCode=$exitCode
        error=$err;checks=$checks.ToArray();closureChecks=$closure.ToArray()
        registryBefore=$registryBefore;registryAfter=$registryAfter;shortcuts=$shortcuts
        backup=$backup;backupComplete=$backupComplete;explicitProcessTermination=$false;automaticRetry=$false
        worldAndWorkspaceReinstalled=$false;publicUpload=$false;normalProfileRead=$false;vaultRead=$false
    } | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $receiptPath -Encoding utf8
}
if (!$complete) { throw ('Installation did not pass. Preserve receipt and backup: '+$err) }
Write-Output ('installed_platform_verified=true; checks='+$checks.Count)
