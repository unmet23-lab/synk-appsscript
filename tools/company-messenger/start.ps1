param([switch]$NoBrowser, [int]$Port = 4197)
$ErrorActionPreference = 'Stop'
# An installed workspace owns login and both modules. Keep the old shortcut useful.
$companyRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\docs\마케팅\온라인마케팅지도\engagement\company'))
if ($Port -eq 4197 -and (Test-Path -LiteralPath (Join-Path $companyRoot 'data\workspace-integration.json'))) {
  & (Join-Path $companyRoot 'start-company.ps1') -Messenger -NoBrowser:$NoBrowser
  exit $LASTEXITCODE
}
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
$appRoot = $PSScriptRoot
$appUrl = "http://127.0.0.1:$Port"
$appData = Join-Path $appRoot 'data'
function Get-MessengerHealth {
  try {
    $response = Invoke-RestMethod -Uri "$appUrl/api/health" -TimeoutSec 2
    return $response.service -eq 'synk-company-messenger'
  } catch { return $false }
}
if (-not (Get-MessengerHealth)) {
  $candidates = @()
  $systemNode = Get-Command node -ErrorAction SilentlyContinue
  if ($systemNode) { $candidates += $systemNode.Source }
  $candidates += (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
  $nodePath = $null
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      $version = & $candidate --version
      if ($version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 24) { $nodePath = $candidate; break }
    }
  }
  if (-not $nodePath) { throw 'Node.js 24 or newer is required. Install Node.js, then run this launcher again.' }
  New-Item -ItemType Directory -Path $appData -Force | Out-Null
  $env:MESSENGER_PORT = "$Port"
  $env:MESSENGER_DATA_DIR = $appData
  $serverPath = Join-Path $appRoot 'server.mjs'
  $started = Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $appData 'server.log') -RedirectStandardError (Join-Path $appData 'server-error.log')
  $started.Id | Set-Content -LiteralPath (Join-Path $appData "server-$Port.pid") -Encoding ascii
  $ready = $false
  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    Start-Sleep -Milliseconds 200
    if (Get-MessengerHealth) { $ready = $true; break }
    if ($started.HasExited) { break }
  }
  if (-not $ready) { throw "Messenger did not start. Check $appData\server-error.log (the port may already be in use)." }
}
if (-not $NoBrowser) { Start-Process $appUrl }
Write-Output "SYNK messenger: $appUrl"
