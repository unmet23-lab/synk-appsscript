@echo off
powershell.exe -NoProfile -File "%~dp0tools\open-operations-home.ps1"
if errorlevel 1 pause
