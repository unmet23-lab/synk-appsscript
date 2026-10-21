$ErrorActionPreference = 'Stop'
$taskQa = $PSScriptRoot
$taskRoot = [IO.Path]::GetFullPath((Join-Path $taskQa '../../../..'))
$taskProgram = 'C:\Users\q1212\AppData\Local\Programs\SYNKPlatformPreview'
$taskInstaller = Join-Path $taskRoot '.tmp/platform-reinstall-20261010/attempt2/platform/dist/SYNK Platform Preview-0.4.0-win-x64.exe'
$taskReceiptPath = Join-Path $taskQa 'installed-platform.json'
$taskBackup = [IO.Path]::GetFullPath((Join-Path $taskRoot '.tmp/platform-reinstall-20261010/installed-program-backup'))
$taskBackupParent = [IO.Path]::GetFullPath((Join-Path $taskRoot '.tmp/platform-reinstall-20261010'))
$taskChecks = [System.Collections.Generic.List[object]]::new()
$taskClosureChecks = [System.Collections.Generic.List[object]]::new()
$taskStartedAt = [DateTime]::UtcNow.ToString('o')
$taskProcess = $null
$taskExitCode = $null
$taskError = $null
$taskInvoked = $false
$taskComplete = $false
$taskBackupComplete = $false
function Task-Hash($taskPath) { (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant() }
function Task-Check($taskName, $taskOk) {
    $taskChecks.Add([ordered]@{name=$taskName;ok=[bool]$taskOk})
    if (!$taskOk) { throw ('Acceptance failed: '+$taskName) }
}
function Assert-TaskAppsClosed {
    $taskBlocked = @()
    $taskFolders = @('SYNKPlatformPreview','SYNKMessengerPreview','SYNKWorldPreview') | ForEach-Object { 'C:\Users\q1212\AppData\Local\Programs\'+$_+'\' }
    foreach ($taskRunning in Get-CimInstance Win32_Process) {
        if ($taskRunning.Name -in @('SYNKPlatformPreview.exe','SYNKMessengerPreview.exe','SYNKWorldPreview.exe') -or ($taskRunning.ExecutablePath -and @($taskFolders | Where-Object { $taskRunning.ExecutablePath.StartsWith($_,[StringComparison]::OrdinalIgnoreCase) }).Count -gt 0)) {
            $taskBlocked += [ordered]@{pid=$taskRunning.ProcessId;name=$taskRunning.Name}
        }
    }
    $taskClosureChecks.Add([ordered]@{checkedAt=[DateTime]::UtcNow.ToString('o');closed=($taskBlocked.Count -eq 0);blocked=$taskBlocked})
    if ($taskBlocked.Count -gt 0) { throw 'A SYNK program is running. No app is terminated; installation is refused.' }
}
if (Test-Path -LiteralPath $taskReceiptPath) { throw 'Preserve the previous installation receipt.' }
try {
    $taskReview = Get-Content -LiteralPath (Join-Path $taskQa 'review/official-review-validation.json') -Raw | ConvertFrom-Json
    $taskApproval = Get-Content -LiteralPath (Join-Path $taskQa 'review/assessment.json') -Raw | ConvertFrom-Json
    Task-Check 'official-review-completed' ($taskReview.harnessCompletionVerified -eq $true -and $taskReview.exitCode -eq 0 -and $taskReview.terminalReason -eq 'completed' -and $taskReview.isError -eq $false -and $taskReview.permissionDenials -eq 0 -and @($taskReview.actualModelUsageKeys).Count -eq 1 -and $taskReview.actualModelUsageKeys[0] -eq 'claude-opus-5-5')
    Task-Check 'root-v2-assessment' ($taskApproval.platformReinstallApproved -eq $true -and $taskApproval.executionPlan -eq 'install-platform-v2.ps1')
    Task-Check 'review-report-pin' ((Task-Hash (Join-Path $taskQa 'review/official-review.json')) -eq $taskReview.rawSHA256 -and $taskReview.rawSHA256 -eq $taskApproval.reviewRawSHA256)
    Task-Check 'review-index-pin' ((Task-Hash (Join-Path $taskQa 'review/index.json')) -eq $taskReview.indexSHA256 -and $taskReview.indexSHA256 -eq $taskApproval.reviewIndexSHA256)
    Task-Check 'execution-plan-pin' ((Task-Hash $PSCommandPath) -eq $taskApproval.executionPlanSHA256)
    $taskPayloadPath = Join-Path $taskQa 'platform-payload-manifest.json'
    Task-Check 'payload-manifest-pin' ((Task-Hash $taskPayloadPath) -eq $taskApproval.payloadManifestSHA256)
    $taskPayload = Get-Content -LiteralPath $taskPayloadPath -Raw | ConvertFrom-Json
    Task-Check 'payload-has-76-files' (@($taskPayload.files).Count -eq 76)
    Assert-TaskAppsClosed
    Task-Check 'installer-pin' ((Task-Hash $taskInstaller) -eq '0ee66f9f697b9e718a917aa93afe925ff11ce4693250801de4db9fb531c66daa')
    Task-Check 'installed-baseline' ((Task-Hash (Join-Path $taskProgram 'resources/app.asar')) -eq '1acaf762ff06a606d6ad9e91972f286a980f657e45fee4b2e2842b8ec84f4f39')
    Task-Check 'old-uninstaller-pin' ((Task-Hash (Join-Path $taskProgram 'Uninstall SYNKPlatformPreview.exe')) -eq $taskApproval.oldUninstallerSHA256)
    $taskRegistryPath = 'HKCU:\Software\c4ee183e-8850-55ce-9d7f-a3a1acb8c830'
    $taskExistingFolder = (Get-ItemProperty -LiteralPath $taskRegistryPath).InstallLocation
    Task-Check 'registered-install-folder' ([IO.Path]::GetFullPath($taskExistingFolder).TrimEnd([char]92) -eq $taskProgram)
    Task-Check 'backup-contained-in-ignored-tmp' ($taskBackup.StartsWith($taskBackupParent+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))
    Task-Check 'backup-does-not-exist' (!(Test-Path -LiteralPath $taskBackup))
    Task-Check 'free-space-at-least-2GB' ((Get-PSDrive -Name C).Free -ge 2000000000)
    Task-Check 'no-program-reparse-points-including-hidden' (@(Get-ChildItem -LiteralPath $taskProgram -Force -Recurse -Attributes ReparsePoint).Count -eq 0)
    Copy-Item -LiteralPath $taskProgram -Destination $taskBackup -Recurse -Force
    $taskBeforeFiles = @(Get-ChildItem -LiteralPath $taskProgram -Recurse -Force -File)
    Task-Check 'full-program-backup' (@($taskBeforeFiles | Where-Object {
        $taskRelative = [IO.Path]::GetRelativePath($taskProgram,$_.FullName)
        $taskSaved = Join-Path $taskBackup $taskRelative
        !(Test-Path -LiteralPath $taskSaved -PathType Leaf) -or (Task-Hash $taskSaved) -ne (Task-Hash $_.FullName)
    }).Count -eq 0)
    $taskBackupComplete = $true
    Task-Check 'post-backup-space-at-least-1.3GB' ((Get-PSDrive -Name C).Free -ge 1300000000)
    Assert-TaskAppsClosed
    $taskProcess = Start-Process -FilePath $taskInstaller -ArgumentList @('/S') -WindowStyle Hidden -PassThru
    $taskInvoked = $true
    $taskDeadline = [DateTime]::UtcNow.AddSeconds(180)
    while (!$taskProcess.WaitForExit(1000)) {
        if ([DateTime]::UtcNow -ge $taskDeadline) { throw 'Installer exceeded 180 seconds. Preserve its PID and backup; do not terminate or retry.' }
    }
    $taskExitCode = $taskProcess.ExitCode
    Task-Check 'nsis-exit0' ($taskExitCode -eq 0)
    foreach ($taskFile in $taskPayload.files) {
        $taskDestination = [IO.Path]::GetFullPath((Join-Path $taskProgram $taskFile.path))
        Task-Check ('payload-'+$taskFile.path) ($taskDestination.StartsWith($taskProgram+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $taskDestination -PathType Leaf) -and (Get-Item -LiteralPath $taskDestination).Length -eq $taskFile.bytes -and (Task-Hash $taskDestination) -eq $taskFile.sha256)
    }
    $taskActualSet = @(Get-ChildItem -LiteralPath $taskProgram -Recurse -Force -File | ForEach-Object { [IO.Path]::GetRelativePath($taskProgram,$_.FullName).Replace([char]92,[char]47) } | Sort-Object)
    $taskExpectedSet = @(@($taskPayload.files.path) + 'Uninstall SYNKPlatformPreview.exe' | Sort-Object)
    Task-Check 'entire-installed-file-set' (@(Compare-Object $taskActualSet $taskExpectedSet).Count -eq 0)
    Task-Check 'no-installed-reparse-points-including-hidden' (@(Get-ChildItem -LiteralPath $taskProgram -Force -Recurse -Attributes ReparsePoint).Count -eq 0)
    $taskComplete = $true
} catch {
    $taskError = $_.Exception.Message
} finally {
    [ordered]@{
        startedAt=$taskStartedAt;completedAt=[DateTime]::UtcNow.ToString('o');installed=$taskComplete
        installerExecuted=$taskInvoked;installerPID=if($taskProcess){$taskProcess.Id}else{$null};exitCode=$taskExitCode
        executionPlan='install-platform-v2.ps1';error=$taskError;checks=$taskChecks.ToArray();closureChecks=$taskClosureChecks.ToArray()
        backup=$taskBackup;backupComplete=$taskBackupComplete;normalProfileRead=$false;vaultRead=$false
        explicitProcessTermination=$false;nsisBuiltinTerminationPathExists=$true;nsisTerminationNotIndependentlyObserved=$true
        worldAndWorkspaceReinstalled=$false;publicUpload=$false;automaticRetry=$false;credentialRestore=$false
    } | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $taskReceiptPath -Encoding utf8
}
if (!$taskComplete) { throw ('Installation did not pass. Preserve receipt and backup: '+$taskError) }
Write-Output ('installed_platform_full_payload_verified=true; checks='+$taskChecks.Count)
