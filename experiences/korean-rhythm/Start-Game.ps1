$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskUrl = 'http://127.0.0.1:5201/'
$taskReady = $false
try {
    $taskResponse = Invoke-WebRequest -Uri $taskUrl -UseBasicParsing -TimeoutSec 2
    if ($taskResponse.Content -notmatch '말의 리듬 · SYNK LAB PLAY') { throw '5201 포트를 다른 서비스가 사용하고 있어요.' }
    $taskReady = $true
} catch {
    if ($_.Exception.Message -match '다른 서비스') { throw }
}
if (-not $taskReady) {
    $taskNode = (Get-Command node -ErrorAction Stop).Source
    $taskServer = Join-Path $taskRoot 'server.mjs'
    Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskServer + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'qa\server.log') -RedirectStandardError (Join-Path $taskRoot 'qa\server-error.log') | Out-Null
}
Write-Output ('게임 주소: ' + $taskUrl)
Write-Output 'F·J 키(←·→)나 화면 아래 O·X 단추로 연주해요. Space·Esc는 잠깐 멈춤이에요.'
