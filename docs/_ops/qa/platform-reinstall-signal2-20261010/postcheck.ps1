$ErrorActionPreference = 'Stop'
# install.ps1의 마지막 확인 세 가지를 다시 한다(설치는 다시 하지 않음).
# install.ps1은 제거 키의 InstallLocation(이 빌더는 그 칸을 쓰지 않는다)을 읽다가 멈췄다. 설치 위치는 앱 키에서 본다.
$qa = $PSScriptRoot
$program = Join-Path $env:LOCALAPPDATA 'Programs\SYNKPlatformPreview'
$guid = 'c4ee183e-8850-55ce-9d7f-a3a1acb8c830'
$checks = [System.Collections.Generic.List[object]]::new()
function Check($name, $ok, $detail) { $checks.Add([ordered]@{name=$name;ok=[bool]$ok;detail=$detail}) }
$u = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid" -ErrorAction SilentlyContinue
$a = Get-ItemProperty -LiteralPath "HKCU:\Software\$guid" -ErrorAction SilentlyContinue
Check 'registry-uninstall-entry' ($u -and $u.DisplayName -eq 'SYNK Platform Preview 0.4.0' -and $u.DisplayVersion -eq '0.4.0' -and $u.UninstallString -eq ('"'+(Join-Path $program 'Uninstall SYNKPlatformPreview.exe')+'" /currentuser')) ([ordered]@{displayName=$u.DisplayName;displayVersion=$u.DisplayVersion;uninstallString=$u.UninstallString;publisher=$u.Publisher;quietUninstallString=$u.QuietUninstallString})
Check 'registry-app-install-location' ($a -and $a.InstallLocation -and ([IO.Path]::GetFullPath($a.InstallLocation).TrimEnd([char]92) -eq $program)) ([ordered]@{installLocation=$a.InstallLocation})
Check 'hklm-not-used' (!(Test-Path -LiteralPath "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid") -and !(Test-Path -LiteralPath "HKLM:\Software\$guid")) $null
$shell = New-Object -ComObject WScript.Shell
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\SYNK Platform Preview.lnk'
$desk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SYNK Platform Preview.lnk'
$exe = Join-Path $program 'SYNKPlatformPreview.exe'
$startTarget = if (Test-Path -LiteralPath $start) { $shell.CreateShortcut($start).TargetPath } else { $null }
$deskTarget = if (Test-Path -LiteralPath $desk) { $shell.CreateShortcut($desk).TargetPath } else { $null }
Check 'start-menu-shortcut-targets-installed-exe' ($startTarget -and ([IO.Path]::GetFullPath($startTarget) -eq $exe)) ([ordered]@{path=$start;target=$startTarget})
Check 'desktop-shortcut-targets-installed-exe' ($deskTarget -and ([IO.Path]::GetFullPath($deskTarget) -eq $exe)) ([ordered]@{path=$desk;target=$deskTarget})
Check 'app-not-auto-launched' (@(Get-CimInstance Win32_Process -Filter "Name='SYNKPlatformPreview.exe'").Count -eq 0) $null
$wantAsar = (@((Get-Content -LiteralPath (Join-Path $qa 'payload-manifest.json') -Raw | ConvertFrom-Json).files) | Where-Object { $_.path -eq 'resources/app.asar' }).sha256
$haveAsar = (Get-FileHash -LiteralPath (Join-Path $program 'resources\app.asar') -Algorithm SHA256).Hash.ToLowerInvariant()
Check 'installed-asar-is-new' ($wantAsar -and $haveAsar -eq $wantAsar) ([ordered]@{sha256=$haveAsar})
$others = @('SYNKWorldPreview','SYNKMessengerPreview') | ForEach-Object { [ordered]@{folder=$_;exists=(Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA ('Programs\'+$_)))} }
$result = [ordered]@{checkedAt=[DateTime]::UtcNow.ToString('o');ok=(@($checks | Where-Object { -not $_.ok }).Count -eq 0);checks=$checks.ToArray();otherSynkProgramFolders=$others;installerReRun=$false;registryModifiedByCheck=$false}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qa 'installed-postcheck.json') -Encoding utf8
$result.checks | ForEach-Object { '{0} {1}' -f ($(if ($_.ok) {'OK  '} else {'FAIL'})), $_.name }
