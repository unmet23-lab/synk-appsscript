# Dot-sourced first by every script the clean-Windows exercise starts as another user (Start-Process -Credential).
# That start passes the caller's environment on — APPDATA, LOCALAPPDATA, TEMP, USERNAME of the runner's administrator —
# and the app and its worker find their folders there, so this puts this user's own back from the token and the
# profile list, the way a logon (and Task Scheduler) gives them. Synthetic accounts only.
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$profileFolder = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$($identity.User.Value)").ProfileImagePath
if (-not $profileFolder) { throw 'no profile folder for this user' }
$swbDomain, $swbName = $identity.Name -split '\\', 2
$env:USERPROFILE = $profileFolder
$env:HOMEDRIVE = $profileFolder.Substring(0, 2); $env:HOMEPATH = $profileFolder.Substring(2)
$env:APPDATA = Join-Path $profileFolder 'AppData\Roaming'
$env:LOCALAPPDATA = Join-Path $profileFolder 'AppData\Local'
$env:TEMP = $env:TMP = Join-Path $env:LOCALAPPDATA 'Temp'
$env:USERNAME = $swbName; $env:USERDOMAIN = $swbDomain
New-Item -ItemType Directory -Force -Path $env:APPDATA, $env:LOCALAPPDATA, $env:TEMP | Out-Null
