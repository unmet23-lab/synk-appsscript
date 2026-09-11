$ErrorActionPreference = 'Stop'
$studioEntry = Join-Path $PSScriptRoot 'server.cjs'
$studioNode = (Get-Command node -ErrorAction Stop).Source
$studioRuntime = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $studioRuntime -Force | Out-Null
$studioUrl = 'http://127.0.0.1:4318'
$studioRunning = $false
try { $studioRunning = (Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 2).ok } catch {}
if (-not $studioRunning) {
  Start-Process -FilePath $studioNode -ArgumentList @('"' + $studioEntry + '"') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studioRuntime 'server.log') -RedirectStandardError (Join-Path $studioRuntime 'server-error.log') | Out-Null
  foreach ($studioAttempt in 1..30) {
    Start-Sleep -Milliseconds 300
    try { if ((Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 1).ok) { $studioRunning=$true; break } } catch {}
  }
}
if (-not $studioRunning) { throw '작업실을 시작하지 못했습니다. .runtime/server-error.log를 확인해 주세요.' }
Start-Process $studioUrl
Write-Output "SYNK 근거 작업실: $studioUrl"
