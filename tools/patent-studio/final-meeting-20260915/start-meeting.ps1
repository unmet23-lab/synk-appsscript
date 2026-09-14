param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$studioEntry = Join-Path $studioRoot 'server.cjs'
$studioNode = (Get-Command node -ErrorAction Stop).Source
$launchDir = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $launchDir -Force | Out-Null
$chosenPort = $null
$reused = $false
foreach ($candidatePort in 4320..4329) {
  $candidateUrl = "http://127.0.0.1:$candidatePort"
  $listener = @(Get-NetTCPConnection -LocalPort $candidatePort -State Listen -ErrorAction SilentlyContinue)
  if ($listener.Count -eq 0) { $chosenPort = $candidatePort; break }
  try {
    $health = Invoke-RestMethod -Uri "$candidateUrl/api/health" -TimeoutSec 2
    if ($health.ok -and $health.service -eq 'synk-evidence-studio' -and $health.engineVersion -eq '0.5.0') {
      $chosenPort = $candidatePort; $reused = $true; break
    }
  } catch { }
}
if ($null -eq $chosenPort) { throw '4320-4329 포트가 사용 중입니다. 기존 서버는 종료하지 않았습니다.' }
$studioUrl = "http://127.0.0.1:$chosenPort"
if (-not $reused) {
  $priorPort = $env:SYNK_STUDIO_PORT
  $priorProvider = $env:SYNK_PATENT_STT_PROVIDER
  try {
    $env:SYNK_STUDIO_PORT = [string]$chosenPort
    $env:SYNK_PATENT_STT_PROVIDER = 'local'
    Start-Process -FilePath $studioNode -ArgumentList @('"' + $studioEntry + '"') -WindowStyle Hidden -WorkingDirectory $studioRoot -RedirectStandardOutput (Join-Path $launchDir 'server.log') -RedirectStandardError (Join-Path $launchDir 'server-error.log') | Out-Null
  } finally {
    $env:SYNK_STUDIO_PORT = $priorPort
    $env:SYNK_PATENT_STT_PROVIDER = $priorProvider
  }
  $ready = $false
  foreach ($attempt in 1..40) {
    Start-Sleep -Milliseconds 250
    try {
      $health = Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 1
      if ($health.ok -and $health.service -eq 'synk-evidence-studio' -and $health.engineVersion -eq '0.5.0') { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) { throw '작업실을 시작하지 못했습니다. .runtime/server-error.log를 확인하세요.' }
}
[IO.File]::WriteAllText((Join-Path $launchDir 'url.txt'), $studioUrl, [Text.UTF8Encoding]::new($false))
if (-not $NoBrowser) { Start-Process $studioUrl }
Write-Output $studioUrl
Write-Output '합성 기록 시연 서버를 확인했습니다. 음성·마이크 검사는 별도입니다. 4318의 기존 서버는 변경하지 않았습니다.'
