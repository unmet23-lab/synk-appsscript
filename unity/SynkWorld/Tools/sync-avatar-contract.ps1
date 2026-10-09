param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$worldProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$worldRepository = [IO.Path]::GetFullPath((Join-Path $worldProject '../..'))
$worldSource = Join-Path $worldRepository 'experiences/synk-world-home/avatar-contract.json'
$worldDestination = Join-Path $worldProject 'Assets/SynkWorld/Resources/avatar-contract.json'
$worldRaw = Get-Content -LiteralPath $worldSource -Raw
$worldContract = $worldRaw | ConvertFrom-Json
if ($worldContract.schemaVersion -ne 1 -or $worldContract.id -ne 'mongle' -or $worldContract.renderVersion -lt 3 -or
    $worldContract.units -ne 'meters' -or $worldContract.forward -ne '+Z' -or $worldContract.origin -ne 'feet' -or
    [Math]::Abs($worldContract.height - 1.85) -gt 0.001 -or
    'mongle-apron-starter' -notin $worldContract.slots.body -or 'mongle-scarf-first-steps' -notin $worldContract.slots.neck) {
    throw 'Shared avatar contract is incompatible. Native model data was not changed.'
}
if (-not $CheckOnly) { [IO.File]::Copy($worldSource, $worldDestination, $true) }
$worldSourceHash = (Get-FileHash -LiteralPath $worldSource -Algorithm SHA256).Hash
$worldDestinationHash = if (Test-Path -LiteralPath $worldDestination) { (Get-FileHash -LiteralPath $worldDestination -Algorithm SHA256).Hash } else { $null }
if ($worldSourceHash -ne $worldDestinationHash) { throw 'Native contract copy differs. Run Tools/sync-avatar-contract.ps1 to sync it before building.' }
[ordered]@{ contractId=$worldContract.id; renderVersion=$worldContract.renderVersion; sha256=$worldSourceHash; identical=$true;
    nativeAssetAvailable=($null -ne $worldContract.nativeAsset); nativeRendered=$false;
    note='Identity and slot contract only. The procedural Unity scene has not been replaced by the shared web model.' } | ConvertTo-Json
