$ErrorActionPreference = 'Stop'
# WORLD 펠트 책 Platform 재설치(이 PC). 시그널 2 install.ps1과 같은 절차, 등록 확인은 postcheck.ps1에서 바로잡은 기준으로 한 번에 한다.
$qa = $PSScriptRoot
$root = [IO.Path]::GetFullPath((Join-Path $qa '../../../..'))
$program = Join-Path $env:LOCALAPPDATA 'Programs\SYNKPlatformPreview'
$installer = Join-Path $root 'desktop/artifacts/platform-reinstall-worldbook-20261010/SYNK Platform Preview-0.4.0-win-x64.exe'
$installerSha = (Get-Content -LiteralPath (Join-Path $qa 'package-result.json') -Raw | ConvertFrom-Json).installer.sha256
$baselineAsar = (Get-Content -LiteralPath (Join-Path $root 'docs/_ops/qa/platform-reinstall-signal2-20261010/package-result.json') -Raw | ConvertFrom-Json).asar.new
$receiptPath = Join-Path $qa 'installed-platform.json'
$backupParent = [IO.Path]::GetFullPath((Join-Path $root '.tmp/platform-reinstall-worldbook-20261010'))
$backup = Join-Path $backupParent 'installed-program-backup'
$guid = 'c4ee183e-8850-55ce-9d7f-a3a1acb8c830'
$checks = [System.Collections.Generic.List[object]]::new()
$closure = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTime]::UtcNow.ToString('o')
$proc = $null; $exitCode = $null; $err = $null; $invoked = $false; $complete = $false; $backupComplete = $false
$registryBefore = $null; $registryAfter = $null; $shortcuts = $null
function Get-Sha($p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Check($name, $ok) { $checks.Add([ordered]@{name=$name;ok=[bool]$ok}); if (!$ok) { throw ('Check failed: '+$name) } }
function Read-Registry {
    $u = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid" -ErrorAction SilentlyContinue
    $a = Get-ItemProperty -LiteralPath "HKCU:\Software\$guid" -ErrorAction SilentlyContinue
    [ordered]@{uninstallKeyExists=[bool]$u;displayName=$u.DisplayName;displayVersion=$u.DisplayVersion;uninstallString=$u.UninstallString;appKeyExists=[bool]$a;appInstallLocation=$a.InstallLocation}
}
function Shortcut-Target($path) { if (Test-Path -LiteralPath $path) { (New-Object -ComObject WScript.Shell).CreateShortcut($path).TargetPath } else { $null } }
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
    Check 'installed-baseline-is-signal2-reinstall' ((Get-Sha (Join-Path $program 'resources\app.asar')) -eq $baselineAsar)
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
    Check 'registry-uninstall-entry' ($registryAfter.uninstallKeyExists -and $registryAfter.displayName -eq 'SYNK Platform Preview 0.4.0' -and $registryAfter.displayVersion -eq '0.4.0' -and $registryAfter.uninstallString -eq ('"'+(Join-Path $program 'Uninstall SYNKPlatformPreview.exe')+'" /currentuser'))
    Check 'registry-app-install-location' ($registryAfter.appKeyExists -and $registryAfter.appInstallLocation -and ([IO.Path]::GetFullPath($registryAfter.appInstallLocation).TrimEnd([char]92) -eq $program))
    Check 'hklm-not-used' (!(Test-Path -LiteralPath "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid") -and !(Test-Path -LiteralPath "HKLM:\Software\$guid"))
    $exe = Join-Path $program 'SYNKPlatformPreview.exe'
    $shortcuts = [ordered]@{startMenu=(Shortcut-Target (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\SYNK Platform Preview.lnk'));desktop=(Shortcut-Target (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SYNK Platform Preview.lnk'))}
    Check 'start-menu-shortcut-targets-installed-exe' ($shortcuts.startMenu -and ([IO.Path]::GetFullPath($shortcuts.startMenu) -eq $exe))
    Check 'desktop-shortcut-targets-installed-exe' ($shortcuts.desktop -and ([IO.Path]::GetFullPath($shortcuts.desktop) -eq $exe))
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
