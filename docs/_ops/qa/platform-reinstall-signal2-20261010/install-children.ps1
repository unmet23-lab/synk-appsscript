$ErrorActionPreference = 'Stop'
# WORLD·Workspace 재설치(이 PC). 설치된 파일은 이미 설치 파일 payload와 같고(children-before.json), 빠진 Windows 설치 등록을 되살리는 것이 목적.
# 절차는 install.ps1과 같다. 앱마다: 꺼짐 확인(끄지 않음) → 폴더 전체 백업·대조 → NSIS /S → payload·파일 목록·등록·바로가기 확인 → 영수증.
$qa = $PSScriptRoot
$root = [IO.Path]::GetFullPath((Join-Path $qa '../../../..'))
$backupParent = [IO.Path]::GetFullPath((Join-Path $root '.tmp/platform-reinstall-signal2-20261010'))
$apps = @(
  [ordered]@{id='world';folder='SYNKWorldPreview';exe='SYNKWorldPreview.exe';installer='SYNK WORLD Preview-0.4.0-win-x64.exe';sha='537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4';guid='26232ff5-f9d2-5946-ba23-f2a14a3a286e';displayName='SYNK WORLD Preview 0.4.0';shortcut='SYNK WORLD Preview.lnk'},
  [ordered]@{id='messenger';folder='SYNKMessengerPreview';exe='SYNKMessengerPreview.exe';installer='SYNK Workspace Preview-0.4.0-win-x64.exe';sha='b1028c0891ba7dfe69c0958c41eb3fc2b2b5569104682906b03da794f298f16b';guid='953c4764-b59b-5e41-be9c-d08ba198b736';displayName='SYNK Workspace Preview 0.4.0';shortcut='SYNK Workspace Preview.lnk'}
)
function Get-Sha($p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Assert-Closed($closure) {
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
function Read-Registry($guid) {
    $u = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid" -ErrorAction SilentlyContinue
    $a = Get-ItemProperty -LiteralPath "HKCU:\Software\$guid" -ErrorAction SilentlyContinue
    [ordered]@{uninstallKeyExists=[bool]$u;displayName=$u.DisplayName;displayVersion=$u.DisplayVersion;uninstallString=$u.UninstallString;appKeyExists=[bool]$a;appInstallLocation=$a.InstallLocation}
}
function Shortcut-Target($path) { if (Test-Path -LiteralPath $path) { (New-Object -ComObject WScript.Shell).CreateShortcut($path).TargetPath } else { $null } }
$failed = @()
foreach ($app in $apps) {
    $receiptPath = Join-Path $qa ('installed-'+$app.id+'.json')
    if (Test-Path -LiteralPath $receiptPath) { throw ('Preserve the previous receipt: '+$receiptPath) }
    $program = Join-Path $env:LOCALAPPDATA ('Programs\'+$app.folder)
    $installer = Join-Path $root ('desktop/artifacts/platform-reinstall-signal2-20261010/'+$app.installer)
    $backup = Join-Path $backupParent ($app.folder+'-backup')
    $checks = [System.Collections.Generic.List[object]]::new(); $closure = [System.Collections.Generic.List[object]]::new()
    $startedAt = [DateTime]::UtcNow.ToString('o'); $proc = $null; $exitCode = $null; $err = $null; $invoked = $false; $complete = $false; $backupComplete = $false
    $registryBefore = $null; $registryAfter = $null; $shortcuts = $null
    function Check($name, $ok) { $checks.Add([ordered]@{name=$name;ok=[bool]$ok}); if (!$ok) { throw ('Check failed: '+$name) } }
    try {
        $payload = Get-Content -LiteralPath (Join-Path $qa ($app.id+'-payload-manifest.json')) -Raw | ConvertFrom-Json
        Check 'payload-manifest-matches-installer' ($payload.installerSHA256 -eq $app.sha)
        Assert-Closed $closure
        Check 'installer-pin' ((Get-Sha $installer) -eq $app.sha)
        $registryBefore = Read-Registry $app.guid
        $shortcutsBefore = [ordered]@{startMenu=(Shortcut-Target (Join-Path $env:APPDATA ('Microsoft\Windows\Start Menu\Programs\'+$app.shortcut)));desktop=(Shortcut-Target (Join-Path ([Environment]::GetFolderPath('Desktop')) $app.shortcut))}
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
        Assert-Closed $closure
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
        $expectedSet = @(@($payload.files.path) + ('Uninstall '+$app.folder+'.exe') | Sort-Object)
        Check 'entire-installed-file-set' (@(Compare-Object $actualSet $expectedSet).Count -eq 0)
        Check 'no-installed-reparse-points' (@(Get-ChildItem -LiteralPath $program -Force -Recurse -Attributes ReparsePoint).Count -eq 0)
        $registryAfter = Read-Registry $app.guid
        Check 'registry-uninstall-entry' ($registryAfter.uninstallKeyExists -and $registryAfter.displayName -eq $app.displayName -and $registryAfter.displayVersion -eq '0.4.0' -and $registryAfter.uninstallString -eq ('"'+(Join-Path $program ('Uninstall '+$app.folder+'.exe'))+'" /currentuser'))
        Check 'registry-app-install-location' ($registryAfter.appKeyExists -and $registryAfter.appInstallLocation -and ([IO.Path]::GetFullPath($registryAfter.appInstallLocation).TrimEnd([char]92) -eq $program))
        Check 'hklm-not-used' (!(Test-Path -LiteralPath ("HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\"+$app.guid)) -and !(Test-Path -LiteralPath ("HKLM:\Software\"+$app.guid)))
        $exe = Join-Path $program $app.exe
        $shortcuts = [ordered]@{before=$shortcutsBefore;startMenu=(Shortcut-Target (Join-Path $env:APPDATA ('Microsoft\Windows\Start Menu\Programs\'+$app.shortcut)));desktop=(Shortcut-Target (Join-Path ([Environment]::GetFolderPath('Desktop')) $app.shortcut))}
        Check 'start-menu-shortcut-targets-installed-exe' ($shortcuts.startMenu -and ([IO.Path]::GetFullPath($shortcuts.startMenu) -eq $exe))
        Check 'app-not-auto-launched' (@(Get-CimInstance Win32_Process -Filter ("Name='"+$app.exe+"'")).Count -eq 0)
        $complete = $true
    } catch {
        $err = $_.Exception.Message
    } finally {
        [ordered]@{
            clientId=$app.id;startedAt=$startedAt;completedAt=[DateTime]::UtcNow.ToString('o');installed=$complete
            installer=$installer;installerSHA256=$app.sha;installerExecuted=$invoked;installerPID=if($proc){$proc.Id}else{$null};exitCode=$exitCode
            error=$err;checks=$checks.ToArray();closureChecks=$closure.ToArray();registryBefore=$registryBefore;registryAfter=$registryAfter;shortcuts=$shortcuts
            backup=$backup;backupComplete=$backupComplete;explicitProcessTermination=$false;automaticRetry=$false;publicUpload=$false;normalProfileRead=$false;vaultRead=$false
        } | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $receiptPath -Encoding utf8
    }
    if (!$complete) { $failed += ($app.id+': '+$err); break }
    Write-Output ($app.id+' installed_verified=true; checks='+$checks.Count)
}
if ($failed.Count -gt 0) { throw ('Stopped. Preserve receipts and backups: '+($failed -join '; ')) }
