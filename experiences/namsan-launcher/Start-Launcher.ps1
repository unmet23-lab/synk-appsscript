$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$logs=Join-Path $root 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$node=(Get-Command node.exe -ErrorAction Stop).Source
function Listening($port){return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)}
if(-not (Listening 5195)) {
    Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $root 'server.mjs')+'"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'launcher.log') -RedirectStandardError (Join-Path $logs 'launcher-error.log')
}
if(-not (Listening 5194)) {
    $web=Join-Path (Split-Path -Parent $root) 'dokkaebi-express'
    $vite=Join-Path $web 'node_modules/vite/bin/vite.js'
    Start-Process -FilePath $node -ArgumentList @(('"'+$vite+'"'),'--host','127.0.0.1','--port','5194','--strictPort') -WorkingDirectory $web -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web-error.log')
}
Write-Output 'Unity: http://127.0.0.1:5195/unity'
Write-Output 'Unreal: http://127.0.0.1:5195/unreal'
Write-Output 'Web walk: http://127.0.0.1:5194/namsan.html'
