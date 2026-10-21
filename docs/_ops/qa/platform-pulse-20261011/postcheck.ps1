$ErrorActionPreference = 'Stop'
# Read-only final verification. Do not rerun NSIS or restore the old debug.log.
$qa = $PSScriptRoot
$root = [IO.Path]::GetFullPath((Join-Path $qa '../../../..'))
$program = Join-Path $env:LOCALAPPDATA 'Programs\SYNKPlatformPreview'
$guid = 'c4ee183e-8850-55ce-9d7f-a3a1acb8c830'
$checks = [System.Collections.Generic.List[object]]::new()
$ok = $false; $failure = $null; $registry = $null; $shortcuts = $null
function Get-Sha($p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Check($name, $condition) { $checks.Add([ordered]@{ name=$name; ok=[bool]$condition }); if (!$condition) { throw ('Check failed: '+$name) } }
function Shortcut-Target($p) { if (Test-Path -LiteralPath $p) { (New-Object -ComObject WScript.Shell).CreateShortcut($p).TargetPath } else { $null } }
try {
    $install = Get-Content -LiteralPath (Join-Path $qa 'installed-platform.json') -Raw | ConvertFrom-Json
    $payload = Get-Content -LiteralPath (Join-Path $qa 'payload-manifest.json') -Raw | ConvertFrom-Json
    $baseline = Get-Content -LiteralPath (Join-Path $qa 'baseline-payload.json') -Raw | ConvertFrom-Json
    $package = Get-Content -LiteralPath (Join-Path $qa 'package-result.json') -Raw | ConvertFrom-Json
    $prepared = Get-Content -LiteralPath (Join-Path $qa 'preparation.json') -Raw | ConvertFrom-Json
    $verification = Get-Content -LiteralPath (Join-Path $qa 'verification.json') -Raw | ConvertFrom-Json
    Check 'nsis-completed-once-exit0' ($install.installerExecuted -and $install.exitCode -eq 0 -and !$install.automaticRetry)
    Check 'original-receipt-preserved' ($install.error -eq 'Check failed: entire-installed-file-set' -and !$install.installed)
    Check 'installer-static-verification-passed' ($verification.ok -and $verification.installer.sha256 -eq $package.installer.sha256)
    Check 'full-program-backup-verified-before-install' ($install.backupComplete -and @($install.checks | Where-Object { $_.name -eq 'full-program-backup' -and $_.ok }).Count -eq 1)
    Check 'backup-retains-original-asar' ((Get-Sha (Join-Path $install.backup 'resources/app.asar')) -eq $prepared.baselineSha256)
    Check 'all-original-payload-backed-up' (@($baseline.files | Where-Object { (Get-Sha (Join-Path $install.backup $_.path)) -ne $_.sha256 }).Count -eq 0)
    Check 'old-diagnostic-log-kept-in-backup-only' ((Test-Path -LiteralPath (Join-Path $install.backup 'debug.log') -PathType Leaf) -and !(Test-Path -LiteralPath (Join-Path $program 'debug.log')))
    Check 'payload-count-76' (@($payload.files).Count -eq 76)
    foreach ($file in $payload.files) {
        $target = [IO.Path]::GetFullPath((Join-Path $program $file.path))
        Check ('payload-'+$file.path) ($target.StartsWith($program+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $target -PathType Leaf) -and (Get-Item -LiteralPath $target).Length -eq $file.bytes -and (Get-Sha $target) -eq $file.sha256)
    }
    $actual = @(Get-ChildItem -LiteralPath $program -Recurse -Force -File | ForEach-Object { [IO.Path]::GetRelativePath($program,$_.FullName).Replace([char]92,[char]47) } | Sort-Object)
    $expected = @(@($payload.files.path) + 'Uninstall SYNKPlatformPreview.exe' | Sort-Object)
    Check 'exactly-77-installed-files' ($actual.Count -eq 77 -and @(Compare-Object $actual $expected).Count -eq 0)
    Check 'no-installed-reparse-points' (@(Get-ChildItem -LiteralPath $program -Force -Recurse -Attributes ReparsePoint).Count -eq 0)
    Check 'installed-asar-matches-new-package' ((Get-Sha (Join-Path $program 'resources/app.asar')) -eq $package.asar.new)
    $uninstall = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid" -ErrorAction SilentlyContinue
    $app = Get-ItemProperty -LiteralPath "HKCU:\Software\$guid" -ErrorAction SilentlyContinue
    $registry = [ordered]@{displayName=$uninstall.DisplayName;displayVersion=$uninstall.DisplayVersion;uninstallString=$uninstall.UninstallString;appInstallLocation=$app.InstallLocation}
    Check 'registry-uninstall-entry' ($uninstall -and $registry.displayName -eq 'SYNK Platform Preview 0.4.0' -and $registry.displayVersion -eq '0.4.0' -and $registry.uninstallString -eq ('"'+(Join-Path $program 'Uninstall SYNKPlatformPreview.exe')+'" /currentuser'))
    Check 'registry-app-install-location' ($app -and $registry.appInstallLocation -and ([IO.Path]::GetFullPath($registry.appInstallLocation).TrimEnd([char]92) -eq $program))
    Check 'hklm-not-used' (!(Test-Path -LiteralPath "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid") -and !(Test-Path -LiteralPath "HKLM:\Software\$guid"))
    $exe = Join-Path $program 'SYNKPlatformPreview.exe'
    $shortcuts = [ordered]@{startMenu=(Shortcut-Target (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\SYNK Platform Preview.lnk'));desktop=(Shortcut-Target (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SYNK Platform Preview.lnk'))}
    Check 'start-menu-shortcut-targets-installed-exe' ($shortcuts.startMenu -and ([IO.Path]::GetFullPath($shortcuts.startMenu) -eq $exe))
    Check 'desktop-shortcut-targets-installed-exe' ($shortcuts.desktop -and ([IO.Path]::GetFullPath($shortcuts.desktop) -eq $exe))
    Check 'app-not-auto-launched' (@(Get-CimInstance Win32_Process -Filter "Name='SYNKPlatformPreview.exe'").Count -eq 0)
    $ok = $true
} catch { $failure = $_.Exception.Message }
[ordered]@{completedAt=[DateTime]::UtcNow.ToString('o');ok=$ok;checksPassed=@($checks | Where-Object {$_.ok}).Count;checks=$checks.ToArray();error=$failure;registry=$registry;shortcuts=$shortcuts;installerRerun=$false;diagnosticLogRestored=$false;normalProfileRead=$false;vaultRead=$false;publicUpload=$false} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qa 'installed-postcheck.json') -Encoding utf8
if (!$ok) { throw ('Read-only postcheck failed: '+$failure) }
Write-Output ('installed_postcheck_passed='+$checks.Count)
