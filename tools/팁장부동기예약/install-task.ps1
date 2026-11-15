[CmdletBinding()]
param(
    [string]$TaskName = 'SYNK tip ledger sync',
    [switch]$Apply,
    [switch]$Remove
)

# Registers the NO-AI tip ledger sync as a hidden Windows task that runs every 5 minutes while the PC is signed in.
# It joins the Google tip ledger and the company workspace screen "tips" (contract: the company folder TIP-SHARES.md).
# Chain: pythonw -> <ops copy>\tools\<this folder>\run-hidden.py -> node <ops copy>\tools\<tool>.js --run --quiet (names are Korean; see run-hidden.py).
# Default is a preview that changes nothing (it only reads the existing task). -Apply registers or updates. -Remove deletes.
# Both act only on the task in the root task folder with exactly this name that this script registered for this account: the
# management marker in its description, the same account SID, and a single action that is exactly this launcher with the ops copy
# as working directory. Any other task with the name is left untouched and the script stops (there is no prompt).
# Only the ops copy (%LOCALAPPDATA%\synk\ops\SYNK-appsscript) is registered. This script never edits that copy.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\<this folder>\install-task.ps1 [-Apply | -Remove] [-TaskName "..."]
$ErrorActionPreference = 'Stop'
$TaskFolder = '\'
$Marker = '[synk-managed: tip-ledger-sync v1]'

# Account SID for a task principal's UserId (domain account name, plain name or S-1-...). $null when it cannot be resolved.
function Resolve-TaskUserSid {
    param([string]$UserId)
    if (-not $UserId) { return $null }
    try {
        if ($UserId -match '^S-1-[0-9-]+$') { return ([Security.Principal.SecurityIdentifier]::new($UserId)).Value }
        return ([Security.Principal.NTAccount]::new($UserId)).Translate([Security.Principal.SecurityIdentifier]).Value
    } catch { return $null }
}

# Reads only. 'owned' when the task is this tool registered by this script for this account, else the first reason it is not.
function Get-TaskOwnership {
    param($Task, [string]$Name, [string]$Execute, [string]$Arguments, [string]$WorkingDirectory, [string]$UserSid)
    if ($Task.TaskPath -ne $TaskFolder -or $Task.TaskName -ne $Name) { return 'other-folder-or-name' }
    if (-not ([string]$Task.Description).Contains($Marker)) { return 'no-marker' }
    $sid = Resolve-TaskUserSid -UserId ([string]$Task.Principal.UserId)
    if (-not $sid -or -not $UserSid -or $sid -ne $UserSid) { return 'other-account' }
    $list = @($Task.Actions)
    if ($list.Count -ne 1) { return 'other-action' }
    $only = $list[0]
    if ($only.Execute -ne $Execute -or $only.Arguments -ne $Arguments -or $only.WorkingDirectory -ne $WorkingDirectory) { return 'other-action' }
    return 'owned'
}

# Tests dot-source this file to call the functions above with stand-in task objects; nothing below runs then.
if ($MyInvocation.InvocationName -eq '.') { return }

if ($Apply -and $Remove) { throw 'Use -Apply or -Remove, not both.' }
if ($TaskName -notmatch '^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}$') { throw 'TaskName may use letters, digits, spaces, dots, underscores and hyphens only (no wildcards or folders).' }
if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set.' }
$opsRoot = Join-Path $env:LOCALAPPDATA 'synk\ops\SYNK-appsscript'
$folder = Split-Path $PSScriptRoot -Leaf
$launcher = Join-Path $opsRoot ('tools\' + $folder + '\run-hidden.py')
$toolName = -join [char[]](0xD301, 0xC7A5, 0xBD80, 0xB3D9, 0xAE30)
$tool = Join-Path $opsRoot ('tools\' + $toolName + '.js')
$pythonw = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\pythonw.exe'
$arguments = '-X utf8 -B "{0}"' -f $launcher
$userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value

# Only the root task folder and exactly this name: a task with this name in another folder is a different task and never matches.
$found = @(Get-ScheduledTask -TaskPath $TaskFolder -TaskName $TaskName -ErrorAction SilentlyContinue | Where-Object { $_.TaskPath -eq $TaskFolder -and $_.TaskName -eq $TaskName })
if ($found.Count -gt 1) { throw 'More than one task matched this name in the root task folder. Refusing to modify or remove anything.' }
$existing = $null
if ($found.Count -eq 1) {
    $existing = $found[0]
    $ownership = Get-TaskOwnership -Task $existing -Name $TaskName -Execute $pythonw -Arguments $arguments -WorkingDirectory $opsRoot -UserSid $userSid
    if ($ownership -ne 'owned') { throw ('A task named {0} in the root task folder is not this tool for this account ({1}). Refusing to modify or remove it.' -f $TaskName, $ownership) }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskPath $TaskFolder -TaskName $TaskName -Confirm:$false; Write-Output "Removed: $TaskFolder$TaskName" }
    else { Write-Output "Nothing to remove: $TaskFolder$TaskName" }
    exit 0
}

foreach ($required in @($pythonw, $launcher, $tool)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing: $required" }
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$triggers = @(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5))
Write-Output "Task: $TaskFolder$TaskName"
Write-Output "User: $identity (interactive, limited)"
Write-Output "Run: $pythonw $arguments"
Write-Output "Working directory: $opsRoot"
Write-Output 'Every 5 minutes while signed in, first run in 2 minutes, start when available, ignore new while running, stop after 10 min, priority 4'
if (-not $Apply) {
    Write-Output 'Preview only. Nothing changed. Re-run with -Apply to register.'
    exit 0
}
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $opsRoot
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$description = 'SYNK tip ledger sync, every 5 minutes. No AI: reads the tip ledger and reference cards, moves the Apply and Discard choices made in the company workspace into the ledger status column, and uploads the rows. '
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -Priority 4
$task = New-ScheduledTask -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description ($description + $Marker)
Register-ScheduledTask -TaskPath $TaskFolder -TaskName $TaskName -InputObject $task -Force:$([bool]$existing) -ErrorAction Stop | Out-Null
Write-Output "Installed: $TaskFolder$TaskName"
