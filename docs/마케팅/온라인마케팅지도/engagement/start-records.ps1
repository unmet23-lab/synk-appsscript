$ErrorActionPreference = 'Stop'
$port = 4188
$url = "http://127.0.0.1:$port/"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { 'C:\Users\q1212\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js 실행 파일을 찾지 못했습니다.' }

$ready = $false
try {
  $catalog = Invoke-RestMethod -Uri ($url + 'api/catalog') -TimeoutSec 2
  $ready = $null -ne $catalog.channels
} catch {}
if (-not $ready) {
  Start-Process -FilePath $nodePath -ArgumentList @((Join-Path $PSScriptRoot 'server.mjs')) -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 200
    try {
      $catalog = Invoke-RestMethod -Uri ($url + 'api/catalog') -TimeoutSec 2
      if ($null -ne $catalog.channels) { $ready = $true; break }
    } catch {}
  }
}
if (-not $ready) { throw '로컬 기록 서버를 시작하지 못했습니다. 4188 포트 상태를 확인해 주세요.' }
Start-Process $url
