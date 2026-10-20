param(
    [string]$HermesHome = (Join-Path $env:LOCALAPPDATA 'hermes'),
    [switch]$ReadOnly
)

# Process recovery only. All agent execution remains in the official Hermes CLI.
$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $HermesHome 'gateway.pid'
$cliPath = Join-Path $HermesHome 'bin/hermes.exe'

# A running gateway keeps the dependency generation it booted with. When a CLI run installs an extra
# afterwards, the gateway refuses to load it and every turn needing it fails until a restart
# (2026-10-19: anthropic landed 24 seconds after a restart; Telegram turns failed for an hour).
function Get-DependencyDrift {
    param([string[]]$ModulePaths, [string]$InstallsRoot)
    $root = [IO.Path]::GetFullPath($InstallsRoot).TrimEnd('\') + '\'
    $loaded = @{}
    foreach ($file in $ModulePaths) {
        if ($file -and $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and
            $file.Substring($root.Length) -match '^([^\\]+)\\environments\\([^\\]+)\\venv\\') {
            $loaded[$Matches[1] + '\' + $Matches[2]] = $true
        }
    }
    # No generation, or more than one: drift cannot be proven, so recovery stays out of it.
    if ($loaded.Count -ne 1) { return $null }
    $install, $generation = @($loaded.Keys)[0] -split '\\'
    try {
        $facts = Get-Content -LiteralPath (Join-Path (Join-Path $root $install) 'facts.json') -Raw | ConvertFrom-Json
        $selected = [IO.Path]::GetFullPath([string]$facts.packages.venv.environment).TrimEnd('\')
    } catch {
        return $null
    }
    $pattern = '^' + [regex]::Escape($root + $install + '\environments\') + '([^\\]+)\\venv$'
    if (!($selected -match $pattern)) { return $null }
    if ($Matches[1] -ieq $generation) { return $null }
    [pscustomobject]@{ Loaded = $generation; Selected = $Matches[1] }
}

# Hermes's own busy contract (gateway/status.py derive_gateway_busy): serving with no active agents.
# A restart does not drain by default, so background processes and tool children also count as busy.
# Gap: Hermes writes active_agents at chat-turn boundaries only, so an in-process LLM cron run that
# started between chats looks idle. SYNK's only cron today is a no-agent script (a child process).
function Test-GatewayIdle {
    param([int]$GatewayPid, [string]$HermesHome)
    $checkpoint = Join-Path $HermesHome 'processes.json'
    try {
        $state = Get-Content -LiteralPath (Join-Path $HermesHome 'gateway_state.json') -Raw | ConvertFrom-Json
        # Hermes writes the background-process checkpoint only once a background process has run.
        $background = if (Test-Path -LiteralPath $checkpoint) { (Get-Content -LiteralPath $checkpoint -Raw).Trim() } else { '[]' }
    } catch {
        return $false
    }
    if ([int]$state.pid -ne $GatewayPid -or $state.gateway_state -notin @('running', 'degraded')) { return $false }
    if ([int]$state.active_agents -ne 0 -or $background -ne '[]') { return $false }
    $children = @(Get-CimInstance Win32_Process -Filter ('ParentProcessId={0}' -f $GatewayPid) |
        Where-Object { $_.Name -ne 'conhost.exe' })
    return $children.Count -eq 0
}

function New-RecoveryResult {
    param([int]$Code, [string]$Message, [switch]$Warn)
    [pscustomobject]@{ Code = $Code; Message = $Message; Warn = [bool]$Warn }
}

# Decides what a drifted gateway needs. $Restart runs the official CLI and returns its exit code, or
# $null while it is still running; tests pass a stand-in.
function Invoke-DriftRecovery {
    param($Drift, [int]$GatewayPid, [string]$HermesHome, [switch]$ReadOnly, [scriptblock]$Restart)
    $stateFile = Join-Path $HermesHome 'synk-gateway-recovery.json'
    $note = 'Gateway runs dependency generation {0}, but {1} was published after it started.' -f $Drift.Loaded, $Drift.Selected
    if ($ReadOnly) { return New-RecoveryResult 5 "$note Recovery would call the official gateway restart once the gateway is idle." }
    $seen = $null
    try { $seen = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json } catch { $seen = $null }
    if (!$seen -or $seen.selected -ne $Drift.Selected) {
        # Act on the second sighting only, so a publication or a restart already under way settles first.
        [pscustomobject]@{ selected = $Drift.Selected; loaded = $Drift.Loaded; firstSeen = (Get-Date).ToString('o'); firstSeenUnix = [DateTimeOffset]::Now.ToUnixTimeSeconds() } |
            ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
        return New-RecoveryResult 0 "$note Checking again before restarting."
    }
    if ($seen.restartRequested) {
        return New-RecoveryResult 4 "$note A restart for this generation was already requested; not repeating it." -Warn
    }
    if (!(Test-GatewayIdle -GatewayPid $GatewayPid -HermesHome $HermesHome)) {
        # Keep waiting, but stop calling it routine once the gateway has looked busy for half an hour.
        if ([DateTimeOffset]::Now.ToUnixTimeSeconds() - [long]$seen.firstSeenUnix -ge 1800) {
            return New-RecoveryResult 6 "$note The gateway has looked busy for over 30 minutes; restart still deferred." -Warn
        }
        return New-RecoveryResult 0 "$note The gateway is busy; restart deferred."
    }
    # Record the attempt first so a restart that does not clear the drift is never repeated.
    [pscustomobject]@{ selected = $Drift.Selected; loaded = $Drift.Loaded; firstSeen = $seen.firstSeen; firstSeenUnix = $seen.firstSeenUnix; restartRequested = (Get-Date).ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    $exitCode = & $Restart
    if ($null -eq $exitCode) {
        return New-RecoveryResult 3 "$note Official gateway restart is still in progress. No process was terminated." -Warn
    }
    if ($exitCode -ne 0) {
        return New-RecoveryResult 1 "$note Official gateway restart failed (exit $exitCode). Review the Hermes gateway logs." -Warn
    }
    New-RecoveryResult 0 "$note Official gateway restart completed. Delivery must be verified separately."
}

# The last check's outcome for the AI-free SYNK monitor (tools/hermes-synk/overview.cjs), which turns a
# lasting drift (codes 4 and 6) into one Telegram notice. ASCII only, so Windows PowerShell writes no BOM;
# the monitor owns the wording. Best effort: a failed write must never stop the recovery itself.
function Write-RecoveryStatus {
    param([string]$HermesHome, [int]$Code, $Drift)
    try {
        $since = $null
        if ($Drift) {
            try {
                $seen = Get-Content -LiteralPath (Join-Path $HermesHome 'synk-gateway-recovery.json') -Raw | ConvertFrom-Json
                if ($seen.firstSeenUnix) { $since = [DateTimeOffset]::FromUnixTimeSeconds([long]$seen.firstSeenUnix) }
            } catch {
                $since = $null
            }
        }
        $format = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        $culture = [Globalization.CultureInfo]::InvariantCulture
        $record = [ordered]@{
            schemaVersion = 1
            checkedAt = [DateTimeOffset]::UtcNow.ToString($format, $culture)
            code = $Code
            drift = [bool]$Drift
            selected = if ($Drift) { [string]$Drift.Selected } else { $null }
            since = if ($since) { $since.ToUniversalTime().ToString($format, $culture) } else { $null }
        }
        $file = Join-Path $HermesHome 'synk-gateway-recovery-status.json'
        $temp = '{0}.{1}.tmp' -f $file, $PID
        [IO.File]::WriteAllText($temp, ($record | ConvertTo-Json -Compress), [Text.Encoding]::ASCII)
        Move-Item -LiteralPath $temp -Destination $file -Force
    } catch {
        Write-Warning 'Could not record the recovery status for the SYNK monitor.'
    }
}

# Tests dot-source this file for the functions above.
if ($MyInvocation.InvocationName -eq '.') { return }

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
    $drift = $null
    $checked = $false
    try {
        $modules = @((Get-Process -Id ([int]$record.pid)).Modules | ForEach-Object { $_.FileName })
        $drift = Get-DependencyDrift -ModulePaths $modules -InstallsRoot (Join-Path $HermesHome 'installs')
        $checked = $true
    } catch {
        $drift = $null
    }
    if (!$drift) {
        # A failed module read proves nothing, so it must not close a warning the monitor is still showing.
        if (!$ReadOnly -and $checked) { Write-RecoveryStatus -HermesHome $HermesHome -Code 0 }
        Write-Output 'Gateway process is running. No action taken.'
        exit 0
    }
    $result = Invoke-DriftRecovery -Drift $drift -GatewayPid ([int]$record.pid) -HermesHome $HermesHome -ReadOnly:$ReadOnly -Restart {
        if (!(Test-Path -LiteralPath $cliPath)) { throw 'Official Hermes CLI is missing; recovery stopped.' }
        $env:HERMES_HOME = $HermesHome
        $env:HERMES_GATEWAY_INSTALL_START_ON_LOGIN = '0'
        $restartProcess = Start-Process -FilePath $cliPath -ArgumentList @('gateway', 'restart') -WindowStyle Hidden -PassThru
        if (!$restartProcess.WaitForExit(180000)) { return $null }
        $restartProcess.ExitCode
    }
    if (!$ReadOnly) { Write-RecoveryStatus -HermesHome $HermesHome -Code $result.Code -Drift $drift }
    if ($result.Warn) { Write-Warning $result.Message } else { Write-Output $result.Message }
    exit $result.Code
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
    Write-RecoveryStatus -HermesHome $HermesHome -Code 3
    Write-Warning 'Official gateway start is still in progress. No process was terminated.'
    exit 3
}
if ($startProcess.ExitCode -ne 0) {
    Write-RecoveryStatus -HermesHome $HermesHome -Code 1
    throw 'Official gateway start failed. Review the Hermes gateway logs.'
}
Write-RecoveryStatus -HermesHome $HermesHome -Code 0
Write-Output 'Official gateway start completed. Delivery must be verified separately.'
