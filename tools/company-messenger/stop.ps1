param([int]$Port = 4197)
$ErrorActionPreference = 'Stop'
$companyRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\docs\마케팅\온라인마케팅지도\engagement\company'))
if ($Port -eq 4197 -and (Test-Path -LiteralPath (Join-Path $companyRoot 'data\workspace-integration.json'))) {
  & (Join-Path $companyRoot 'stop-company.ps1')
  exit $LASTEXITCODE
}
$pidPath = Join-Path $PSScriptRoot "data\server-$Port.pid"
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Output 'No launcher process found.'; exit 0 }
$messengerPid = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$messengerPid)) { throw 'Invalid process record.' }
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $messengerPid" -ErrorAction SilentlyContinue
if ($process) {
  $expectedServer = Join-Path $PSScriptRoot 'server.mjs'
  if ($process.Name -ne 'node.exe' -or -not $process.CommandLine.Contains($expectedServer)) { throw 'The recorded process is not this messenger. It was left running.' }
  Stop-Process -Id $messengerPid
  Write-Output 'SYNK messenger stopped. Messages and files are preserved.'
} else { Write-Output 'The messenger is already stopped.' }
Remove-Item -LiteralPath $pidPath
