param([switch]$NoBrowser, [switch]$Messenger)
$ErrorActionPreference = 'Stop'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$launchArgs = @((Join-Path $PSScriptRoot 'launch.mjs'))
if ($Messenger) { $launchArgs += '--messenger' }
$launchUrl = & $nodePath @launchArgs
if ($LASTEXITCODE -ne 0 -or $launchUrl -notmatch '^http://127\.0\.0\.1:4191/(\?tab=messenger)?#launch=[A-Za-z0-9_-]+$') { throw '싱ㅋ 워크스페이스를 열지 못했습니다.' }
if (-not $NoBrowser) { Start-Process $launchUrl }
Write-Output 'SYNK workspace: http://127.0.0.1:4191/'
