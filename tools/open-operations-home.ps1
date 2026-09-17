$ErrorActionPreference = 'Stop'
$operationsRoot = Split-Path -Parent $PSScriptRoot
$operationsUrl = 'http://127.0.0.1:8790'
$operationsReady = $false
try {
  $operationsHealth = Invoke-RestMethod -Uri "$operationsUrl/api/health" -TimeoutSec 2
  if ($operationsHealth.name -eq 'SYNK 운영 홈' -and [IO.Path]::GetFullPath($operationsHealth.root) -eq [IO.Path]::GetFullPath($operationsRoot)) { $operationsReady = $true }
  else { throw '8790 포트에서 다른 작업 사본이 실행 중입니다.' }
} catch {
  if ($_.Exception.Message -like '*다른 작업 사본*') { throw }
}
if (-not $operationsReady) {
  $operationsNode = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $operationsNode) { $operationsNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
  if (-not (Test-Path -LiteralPath $operationsNode)) { throw 'Node 실행 환경을 찾지 못했습니다.' }
  $operationsScript = Join-Path $PSScriptRoot '운영홈.js'
  Start-Process -FilePath $operationsNode -ArgumentList @('"' + $operationsScript + '"') -WorkingDirectory $operationsRoot -WindowStyle Hidden | Out-Null
  for ($operationsAttempt = 0; $operationsAttempt -lt 20; $operationsAttempt++) {
    Start-Sleep -Milliseconds 250
    try { $operationsHealth = Invoke-RestMethod -Uri "$operationsUrl/api/health" -TimeoutSec 1; if ($operationsHealth.name -eq 'SYNK 운영 홈' -and [IO.Path]::GetFullPath($operationsHealth.root) -eq [IO.Path]::GetFullPath($operationsRoot)) { $operationsReady = $true; break } } catch {}
  }
}
if (-not $operationsReady) { throw '운영 홈을 시작하지 못했습니다. 포트와 실행 환경을 확인하세요.' }
Start-Process $operationsUrl
