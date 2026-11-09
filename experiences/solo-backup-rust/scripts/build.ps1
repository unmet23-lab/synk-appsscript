param(
  [Parameter(Mandatory=$true)][string]$ResticPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
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
& $NodePath (Join-Path $PSScriptRoot 'stage-ui.cjs')
if ($LASTEXITCODE -ne 0) { throw 'UI staging failed.' }
New-Item -ItemType Directory -Path $outputRoot | Out-Null
$stageArgs = @((Join-Path $PSScriptRoot 'stage-resources.cjs'), $NodePath, $ResticPath, (Join-Path $outputRoot 'resources'))
if ($PublicOAuthClient) { $stageArgs += $PublicOAuthClient }
$receipt = & $NodePath @stageArgs
if ($LASTEXITCODE -ne 0) { throw 'Resource staging failed.' }
$resourceResult = $receipt | ConvertFrom-Json
$env:SWB_RESOURCE_MANIFEST_SHA = $resourceResult.manifestSha256
if ($TargetDirectory) { $env:CARGO_TARGET_DIR = [IO.Path]::GetFullPath($TargetDirectory) }
else { $env:CARGO_TARGET_DIR = Join-Path $appRoot 'src-tauri/target' }
$cargoArgs = @()
if ($Toolchain) { $cargoArgs += "+$Toolchain" }
$cargoArgs += @('build','--release','--locked','-j','4','--manifest-path',(Join-Path $appRoot 'src-tauri/Cargo.toml'))
& $cargo @cargoArgs
if ($LASTEXITCODE -ne 0) { throw 'Rust build failed; incomplete output retained for inspection.' }
Copy-Item -LiteralPath (Join-Path $env:CARGO_TARGET_DIR 'release/WorkBackupRust.exe') -Destination (Join-Path $outputRoot 'WorkBackupRust.exe')
$exeHash = (Get-FileHash -LiteralPath (Join-Path $outputRoot 'WorkBackupRust.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
@{ version='0.6.0-rust-beta.1'; exeSha256=$exeHash; resourceManifestSha256=$resourceResult.manifestSha256; resourceFiles=$resourceResult.files } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputRoot 'build-receipt.json') -Encoding utf8
Write-Output "Built $outputRoot"
