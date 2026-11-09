@echo off
rem SYNK restore: double-click this after extracting the zip. ASCII only: cmd.exe reads batch files in the OEM codepage.
rem restore.ps1 is in the subfolder next to this file. Its folder name is Korean, so it is found with a wildcard.
set "S="
if exist "%~dp0restore.ps1" set "S=%~dp0restore.ps1"
if not defined S for /d %%D in ("%~dp0*") do if exist "%%D\restore.ps1" set "S=%%D\restore.ps1"
if not defined S (
  echo Extract the whole zip first, then double-click this file again.
  pause
  exit /b 1
)
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%S%" %*
set "RC=%errorlevel%"
if not "%RC%"=="0" if not "%RC%"=="10" (
  echo.
  echo The script stopped early. Code %RC%. Please show this window to Claude.
  pause
)
