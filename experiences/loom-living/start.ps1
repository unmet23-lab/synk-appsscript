$ErrorActionPreference = 'Stop'
$loomRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$loomUrl = 'http://127.0.0.1:4319/'
$loomRunning = $false
try {
    $loomResponse = Invoke-WebRequest -Uri $loomUrl -TimeoutSec 2 -UseBasicParsing
    if ($loomResponse.Content -notmatch 'SYNK Loom') { throw 'Port 4319 is used by another app.' }
    $loomRunning = $true
} catch {
    if ($_.Exception.Message -match 'Port 4319') { throw }
}
if (-not $loomRunning) {
    $loomNode = (Get-Command node -ErrorAction Stop).Source
    $loomScript = Join-Path $loomRepo 'tools/loom-living-server.cjs'
    Start-Process -FilePath $loomNode -ArgumentList ('"' + $loomScript + '"') -WorkingDirectory $loomRepo -WindowStyle Hidden | Out-Null
}
Write-Output "Loom: $loomUrl"
