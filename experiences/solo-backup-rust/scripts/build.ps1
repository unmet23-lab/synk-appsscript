param(
  [Parameter(Mandatory=$true)][string]$ResticPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][string]$InventoryBinDirectory,
  [string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source,
  [string]$PublicOAuthClient,
  [string]$TargetDirectory,
  [string]$Toolchain
)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $outputRoot) { throw 'OutputDirectory must be a new directory.' }
$cargo = (Get-Command cargo.exe -ErrorAction Stop).Source
$inventoryBin = [IO.Path]::GetFullPath($InventoryBinDirectory)
if ((Split-Path -Leaf $inventoryBin) -ne 'release') { throw 'InventoryBinDirectory must end in release.' }
$inventoryArgs = @()
if ($Toolchain) { $inventoryArgs += "+$Toolchain" }
$inventoryArgs += @('build','--release','--locked','--manifest-path',(Join-Path $appRoot 'inventory/Cargo.toml'),'--target-dir',(Split-Path -Parent $inventoryBin))
& $cargo @inventoryArgs
if ($LASTEXITCODE -ne 0) { throw 'Inventory source build failed.' }
& $NodePath (Join-Path $PSScriptRoot 'stage-ui.cjs')
if ($LASTEXITCODE -ne 0) { throw 'UI staging failed.' }
New-Item -ItemType Directory -Path $outputRoot | Out-Null
$stageArgs = @((Join-Path $PSScriptRoot 'stage-resources.cjs'), $NodePath, $ResticPath, (Join-Path $outputRoot 'resources'))
if ($PublicOAuthClient) { $stageArgs += $PublicOAuthClient } else { $stageArgs += '--none' }
$stageArgs += $InventoryBinDirectory
$receipt = & $NodePath @stageArgs
if ($LASTEXITCODE -ne 0) { throw 'Resource staging failed.' }
$resourceResult = $receipt | ConvertFrom-Json
$env:SWB_RESOURCE_MANIFEST_SHA = $resourceResult.manifestSha256
if ($TargetDirectory) { $env:CARGO_TARGET_DIR = [IO.Path]::GetFullPath($TargetDirectory) }
else { $env:CARGO_TARGET_DIR = Join-Path $appRoot 'src-tauri/target' }
# tauri build compiles both binaries (with its custom-protocol feature) and bundles them with the staged resources
# into the machine-wide NSIS installer (STAGE1_DESIGN.md 4.2 「컴퓨터 전체 설치」): Tauri's template with the changes in
# nsis-template.cjs, and src-tauri/nsis/hooks.nsh. The staged paths are given here, not in tauri.conf.json, so a plain
# cargo build (the tests, CI) needs no staged resources.
$tauri = Join-Path $appRoot 'node_modules/@tauri-apps/cli/tauri.js'
if (-not (Test-Path -LiteralPath $tauri)) { throw 'Tauri CLI missing: run npm ci in experiences/solo-backup-rust.' }
$nsis = Join-Path $outputRoot 'nsis'
& $NodePath (Join-Path $PSScriptRoot 'nsis-template.cjs') (Join-Path $nsis 'installer.nsi')
if ($LASTEXITCODE -ne 0) { throw 'NSIS template check failed.' }
$bundle = @{ bundle = @{ resources = @{ ((Join-Path $outputRoot 'resources') + '\') = 'resources/' }; windows = @{ nsis = @{ template = (Join-Path $nsis 'installer.nsi'); installerHooks = (Join-Path $appRoot 'src-tauri/nsis/hooks.nsh') } } } }
$bundleConfig = Join-Path $nsis 'tauri.bundle.json'
[IO.File]::WriteAllText($bundleConfig, ($bundle | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
if ($Toolchain) { $env:RUSTUP_TOOLCHAIN = $Toolchain }
Push-Location (Join-Path $appRoot 'src-tauri')
try { & $NodePath $tauri build --ci --bundles nsis --config $bundleConfig -- --locked -j 4 } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'Tauri build failed; incomplete output retained for inspection.' }
# The window app and the scheduled-run executable (STAGE1_DESIGN.md 4.2) share one resources folder.
# Tauri marks the window app it puts in the installer as the NSIS bundle (its bundle-type string, UNK → NSS) and writes
# the target copy back unmarked afterwards; the output and the receipt carry the shipped bytes, which the clean-Windows
# check compares with the installed file (workbackup-clean-windows).
$windowApp = [IO.File]::ReadAllBytes((Join-Path $env:CARGO_TARGET_DIR 'release/WorkBackup.exe'))
$latin1 = [Text.Encoding]::GetEncoding(28591)
$marker = '__TAURI_BUNDLE_TYPE_VAR_'
$text = $latin1.GetString($windowApp)
$at = $text.IndexOf($marker + 'UNK', [StringComparison]::Ordinal)
if ($at -lt 0 -or $text.IndexOf($marker, [StringComparison]::Ordinal) -ne $at -or $text.IndexOf($marker, $at + 1, [StringComparison]::Ordinal) -ge 0) {
  throw 'Expected exactly one unmarked Tauri bundle-type string in WorkBackup.exe.'
}
$latin1.GetBytes('NSS').CopyTo($windowApp, $at + $marker.Length)
[IO.File]::WriteAllBytes((Join-Path $outputRoot 'WorkBackup.exe'), $windowApp)
Copy-Item -LiteralPath (Join-Path $env:CARGO_TARGET_DIR 'release/WorkBackupRun.exe') -Destination (Join-Path $outputRoot 'WorkBackupRun.exe')
$built = @(Get-ChildItem -LiteralPath (Join-Path $env:CARGO_TARGET_DIR 'release/bundle/nsis') -Filter '*_0.7.0_x64-setup.exe')
if ($built.Count -ne 1) { throw 'Expected one NSIS installer for 0.7.0.' }
$setupName = 'SynkWorkBackup-0.7.0-setup.exe'
Copy-Item -LiteralPath $built[0].FullName -Destination (Join-Path $outputRoot $setupName)
$setupHash = (Get-FileHash -LiteralPath (Join-Path $outputRoot $setupName) -Algorithm SHA256).Hash.ToLowerInvariant()
$exeHash = (Get-FileHash -LiteralPath (Join-Path $outputRoot 'WorkBackup.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
$runHash = (Get-FileHash -LiteralPath (Join-Path $outputRoot 'WorkBackupRun.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
@{ version='0.7.0'; exeSha256=$exeHash; runExeSha256=$runHash; setup=$setupName; setupSha256=$setupHash; resourceManifestSha256=$resourceResult.manifestSha256; resourceFiles=$resourceResult.files } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputRoot 'build-receipt.json') -Encoding utf8
Write-Output "Built $outputRoot"
