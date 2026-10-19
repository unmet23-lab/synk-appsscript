param(
    [string]$HermesHome = (Join-Path $env:LOCALAPPDATA 'hermes'),
    [switch]$ReadOnly
)

# Process recovery only. All agent execution remains in the official Hermes CLI.
$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $HermesHome 'gateway.pid'
$cliPath = Join-Path $HermesHome 'bin/hermes.exe'
$running = $false
if (Test-Path -LiteralPath $pidFile) {
    try {
        $record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
        if ($record.kind -eq 'hermes-gateway' -and [int]$record.pid -gt 0) {
            $process = Get-CimInstance Win32_Process -Filter ('ProcessId={0}' -f [int]$record.pid)
            # Check both interpreter ownership and the CLI mode; a reused PID is not a gateway.
            $ownedExecutable = $process -and $process.ExecutablePath -and
                [IO.Path]::GetFullPath($process.ExecutablePath).StartsWith(
                    [IO.Path]::GetFullPath($HermesHome).TrimEnd('\') + '\',
                    [StringComparison]::OrdinalIgnoreCase)
            $gatewayMode = $process -and $process.CommandLine -match '(?:hermes_cli(?:[.]main|[\\/]main[.]py)|hermes[.]exe).*\bgateway\s+run\b'
            $running = $ownedExecutable -and $gatewayMode
        }
    } catch {
        # Corrupt/missing PID metadata is resolved by the CLI's own ownership and lock checks.
        $running = $false
    }
}
if ($running) {
    Write-Output 'Gateway process is running. No action taken.'
    exit 0
}
if ($ReadOnly) {
    Write-Output 'Gateway process was not proven running. Recovery would call the official gateway start command.'
    exit 2
}
if (!(Test-Path -LiteralPath $cliPath)) { throw 'Official Hermes CLI is missing; recovery stopped.' }
$env:HERMES_HOME = $HermesHome
$env:HERMES_GATEWAY_INSTALL_START_ON_LOGIN = '0'
$startProcess = Start-Process -FilePath $cliPath -ArgumentList @('gateway', 'start') -WindowStyle Hidden -PassThru
if (!$startProcess.WaitForExit(60000)) {
    Write-Warning 'Official gateway start is still in progress. No process was terminated.'
    exit 3
}
if ($startProcess.ExitCode -ne 0) {
    throw 'Official gateway start failed. Review the Hermes gateway logs.'
}
Write-Output 'Official gateway start completed. Delivery must be verified separately.'
