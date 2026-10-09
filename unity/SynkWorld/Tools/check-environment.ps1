param([switch]$WriteReport)
$ErrorActionPreference = 'Stop'
$worldProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$worldVersion = ((Get-Content -LiteralPath (Join-Path $worldProject 'ProjectSettings/ProjectVersion.txt') -Raw) -split ':',2)[1].Trim()
$worldEditor = Join-Path $env:ProgramFiles "Unity/Hub/Editor/$worldVersion/Editor/Unity.exe"
$worldCli = Get-Command unity.exe -ErrorAction SilentlyContinue
function Read-UnityJson([string[]]$Arguments) {
    if (-not $worldCli) { return $null }
    $worldJson = & $worldCli.Source --json --non-interactive @Arguments 2>$null
    try { return ($worldJson -join "`n" | ConvertFrom-Json) } catch { return $null }
}
$worldAuth = Read-UnityJson @('auth','status')
$worldLicenses = Read-UnityJson @('license','list')
$worldInstalled = Read-UnityJson @('editors','--installed')
$worldAdb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$worldDevices = @()
if (Test-Path -LiteralPath $worldAdb) {
    $worldDeviceRows = & $worldAdb devices -l 2>$null
    foreach ($worldRow in $worldDeviceRows) {
        if ($worldRow -match '^\S+\s+(device|unauthorized|offline)(?:\s|$)') {
            $worldState = $Matches[1]
            $worldModel = if ($worldRow -match 'model:(\S+)') { $Matches[1] } else { 'unknown' }
            # Device serials are deliberately omitted from the shareable readiness report.
            $worldDevices += [ordered]@{ state=$worldState; model=$worldModel }
        }
    }
}
$worldBlender = Join-Path $env:ProgramFiles 'Blender Foundation/Blender 5.2/blender.exe'
$worldBlenderVersion = $null
if (Test-Path -LiteralPath $worldBlender) { $worldBlenderVersion = (& $worldBlender --version | Select-Object -First 1) }
$worldDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($worldProject))
$worldBlockers = @()
if (-not (Test-Path -LiteralPath $worldEditor)) { $worldBlockers += 'Unity Editor executable is absent; an install metadata folder is not an installed Editor.' }
if (-not $worldAuth.data.loggedIn) { $worldBlockers += 'Unity CLI has no signed-in user.' }
if (@($worldLicenses.data).Count -eq 0) { $worldBlockers += 'No active Unity license was reported.' }
if ($worldDrive.AvailableFreeSpace -lt 3859176200) { $worldBlockers += 'Free space is below the Editor-only download size (3,859,176,200 bytes); unpacking and platform modules need additional space.' }
if (@($worldDevices | Where-Object state -eq 'device').Count -eq 0) { $worldBlockers += 'No authorized Android device is connected.' }
$worldReport = [ordered]@{
    checkedAtUtc = [DateTime]::UtcNow.ToString('o')
    scope = 'Read-only environment check; no installation, account change, license acceptance, build, or device launch.'
    expectedEditorVersion = $worldVersion
    editorExecutableExists = (Test-Path -LiteralPath $worldEditor)
    registeredEditorCount = @($worldInstalled.data).Count
    unityCliAvailable = [bool]$worldCli
    unitySignedIn = [bool]$worldAuth.data.loggedIn
    activeLicenseCount = @($worldLicenses.data).Count
    freeDiskBytes = $worldDrive.AvailableFreeSpace
    editorOnlyDownloadBytes = 3859176200
    editorDownloadEvidence = 'unity --json --non-interactive install 6000.6.2f1 --dry-run --no-wait; checked 2026-10-09'
    adbAvailable = (Test-Path -LiteralPath $worldAdb)
    androidDevices = @($worldDevices)
    blenderVersion = $worldBlenderVersion
    platforms = [ordered]@{ Windows='not built'; Android='not built or run'; iOS='not exported; signing/running requires macOS and Xcode' }
    blockers = $worldBlockers
    userScope = '2026-10-09: code and browser verification only; installation and physical-device verification deferred.'
}
$worldOutput = $worldReport | ConvertTo-Json -Depth 8
if ($WriteReport) {
    $worldReportPath = Join-Path $worldProject 'qa/native-environment.json'
    [IO.File]::WriteAllText($worldReportPath, $worldOutput, [Text.UTF8Encoding]::new($false))
}
$worldOutput
