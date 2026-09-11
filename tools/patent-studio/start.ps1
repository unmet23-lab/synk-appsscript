param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$studioEntry = Join-Path $PSScriptRoot 'server.cjs'
$studioNode = (Get-Command node -ErrorAction Stop).Source
$studioRuntime = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $studioRuntime -Force | Out-Null
$studioUrl = 'http://127.0.0.1:4318'
$studioRunning = $false
try { $studioHealth = Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 2; $studioRunning = $studioHealth.ok -and $studioHealth.service -eq 'synk-evidence-studio' -and $studioHealth.engineVersion -eq '0.4.0' } catch {}
if ($studioHealth -and -not $studioRunning) { throw '4318 포트에 다른 실행판이 있습니다. 기존 작업실을 종료한 뒤 다시 실행해 주세요.' }
if (-not $studioRunning) {
  $env:SYNK_PATENT_STT_PROVIDER = 'local'
  Start-Process -FilePath $studioNode -ArgumentList @('"' + $studioEntry + '"') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studioRuntime 'server.log') -RedirectStandardError (Join-Path $studioRuntime 'server-error.log') | Out-Null
  foreach ($studioAttempt in 1..30) {
    Start-Sleep -Milliseconds 300
    try { if ((Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 1).ok) { $studioRunning=$true; break } } catch {}
  }
}
if (-not $studioRunning) { throw '작업실을 시작하지 못했습니다. .runtime/server-error.log를 확인해 주세요.' }
$studioBoot = Invoke-RestMethod -Uri "$studioUrl/api/bootstrap" -TimeoutSec 5
$studioCheck = Invoke-RestMethod -Method Post -Uri "$studioUrl/api/preflight" -Headers @{ Origin=$studioUrl; 'X-Studio-Token'=$studioBoot.token } -ContentType 'application/json' -Body '{}' -TimeoutSec 60
if (-not $studioCheck.ok) { throw '시연 준비에서 확인이 필요한 항목이 있습니다. 작업실의 시연 준비 확인 버튼에서 결과를 확인하세요.' }
if (-not $NoBrowser) { Start-Process $studioUrl }
Write-Output "SYNK 근거 작업실: $studioUrl"
Write-Output '원음·저장·화면·로컬 받아쓰기·판정 검사를 통과했습니다.'
