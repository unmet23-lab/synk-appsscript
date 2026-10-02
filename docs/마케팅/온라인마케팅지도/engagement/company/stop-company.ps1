param([int]$Port = 4191)
$ErrorActionPreference = 'Stop'
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
if (-not $listeners.Count) { Write-Output 'The workspace is already stopped.'; exit 0 }
$expectedServer = Join-Path $PSScriptRoot 'server.mjs'
$workspaceProcessIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($workspaceProcessId in $workspaceProcessIds) {
  $workspaceProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $workspaceProcessId" -ErrorAction SilentlyContinue
  if (-not $workspaceProcess) { continue }
  if ($workspaceProcess.Name -ne 'node.exe' -or -not $workspaceProcess.CommandLine.Contains($expectedServer)) {
    throw 'This port belongs to another application. It was left running.'
  }
  Stop-Process -Id $workspaceProcessId
}
Write-Output 'SYNK workspace stopped. Marketing, studio, messages and files are preserved.'
