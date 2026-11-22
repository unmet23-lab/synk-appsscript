# Run only the recovery for the local Claude LAB country-edition job.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $repo 'tools/숨김실행.py'
$worker = Join-Path $repo 'tools/나라판본뜻복구.js'
$pythonw = Join-Path $env:LOCALAPPDATA 'Python/pythoncore-3.14-64/pythonw.exe'
$config = Join-Path $env:USERPROFILE '.config/synk/lab-meaning-review.json'
foreach ($file in @($launcher, $worker, $pythonw, $config)) {
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file missing: $file" }
}
$name = 'SYNK LAB country meaning review recovery'
$arguments = '-X utf8 -B "{0}" --한도 14400 "{1}" 예약' -f $launcher, $worker
$existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($existing -and (@($existing.Actions).Count -ne 1 -or $existing.Actions[0].Arguments -ne $arguments -or $existing.Actions[0].Execute -ne $pythonw)) {
    throw "Another action already owns this task name."
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 4)
$definition = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Resume pending meaning reviews in the actual Claude country-edition worktree after confirmed subscription exhaustion.'
Register-ScheduledTask -TaskName $name -InputObject $definition -Force:([bool]$existing) | Out-Null
Get-ScheduledTask -TaskName $name | Select-Object TaskName,State

