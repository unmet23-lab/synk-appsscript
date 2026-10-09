param(
    [Parameter(Mandatory=$true)][string]$EditorPath,
    [ValidateSet('Prepare','Windows','Android','iOS','macOS')][string]$Target = 'Prepare'
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $EditorPath -PathType Leaf)) { throw 'Unity Editor 실행 파일 경로가 필요합니다. Unity CLI 실행 파일과 다릅니다.' }
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $EditorPath) 'Data/Managed/UnityEngine/UnityEngine.CoreModule.dll'))) {
    throw '실제 Unity Editor의 Data 폴더를 찾지 못했습니다. Unity CLI 또는 설치 메타데이터만 있는 경로로 빌드할 수 없습니다.'
}
$worldProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& (Join-Path $PSScriptRoot 'sync-avatar-contract.ps1') -CheckOnly
$worldMethods = @{ Prepare='Prepare'; Windows='BuildWindows'; Android='BuildAndroid'; iOS='ExportIOS'; macOS='BuildMac' }
$worldBuildTarget = @{ Windows='Win64'; Android='Android'; iOS='iOS'; macOS='OSXUniversal' }
$worldLogFolder = Join-Path $worldProject 'Logs'
New-Item -ItemType Directory -Force $worldLogFolder | Out-Null
$worldArgs = @('-batchmode','-quit','-projectPath',$worldProject,'-executeMethod',('Synk.World.Editor.WorldProjectSetup.'+$worldMethods[$Target]),'-logFile',(Join-Path $worldLogFolder ($Target+'.log')))
if ($Target -ne 'Prepare') { $worldArgs += @('-buildTarget', $worldBuildTarget[$Target]) }
& $EditorPath @worldArgs
if ($LASTEXITCODE -ne 0) { throw "Unity $Target 실패. Logs/$Target.log를 확인하세요." }
