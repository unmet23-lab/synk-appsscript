$ErrorActionPreference = 'Stop'
$sourceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../video/real-actor-composite-4s-v1'))
$assetDirectory = Join-Path $PSScriptRoot 'assets'
$names = @('source-master.mp4', 'composite-master.mp4', 'portrait-480p.mp4')
$reportPath = Join-Path $sourceDirectory 'render-report.json'
if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) { throw '렌더 완료 보고서가 아직 없습니다.' }
$report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
if ($report.status -ne 'rendered_pending_independent_verification' -or $report.frame_count -ne 96) {
  throw '렌더 완료 상태와 96프레임 확인 전에는 미디어를 복사하지 않습니다.'
}
$missing = @($names | Where-Object { -not (Test-Path -LiteralPath (Join-Path $sourceDirectory $_) -PathType Leaf) })
if ($missing.Count -gt 0) { throw "미디어가 아직 준비되지 않았습니다: $($missing -join ', ')" }
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
foreach ($name in $names) {
  $source = Join-Path $sourceDirectory $name
  $target = Join-Path $assetDirectory $name
  Copy-Item -LiteralPath $source -Destination $target -Force
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) { throw "복사 검증 실패: $name" }
  Write-Output "$name SHA256 $targetHash"
}
Push-Location $PSScriptRoot
try {
  npx --yes hyperframes@0.8.97 media-use resolve --adopt --local-only --project .
  if ($LASTEXITCODE -ne 0) { throw '로컬 media-use adopt 실패' }
} finally { Pop-Location }
