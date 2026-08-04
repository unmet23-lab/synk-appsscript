@echo off
rem notebooklm-drive: bake the memory/docs bundle into PDFs inside the Google Drive
rem folder, so NotebookLM's folder source picks up the new version automatically.
rem Runs daily via Task Scheduler (SYNK_NotebookLM).
rem
rem WHY ASCII ONLY - INCLUDING COMMENTS: cmd.exe parses batch files in the OEM
rem codepage (CP949 here) while this file is saved as UTF-8. Korean bytes get
rem mangled and the damage is NOT contained by "rem" - the broken line cascades and
rem cmd starts executing fragments. Measured 2026-08-04: a single Korean word in a
rem comment made cmd try to run 'daily', 'WHY', 'an' as commands.
rem The Drive mount is named in Korean, so DETECTION lives in the Node tool.
rem
rem WHY NO FALLBACK PATH: if Google Drive Desktop is off there is no mount, and the
rem Node tool exits(2) on purpose. Writing somewhere else would produce the worst
rem state - "looks uploaded, actually is not". The failure is logged instead.
setlocal
set REPO=C:\Users\q1212\Documents\SYNK-appsscript
set LOG=%REPO%\tools\notebooklm-drive.log
cd /d "%REPO%"
if errorlevel 1 exit /b 1
node tools\notebooklm-drive.js >> "%LOG%" 2>&1
if errorlevel 1 (
  echo %date% %time% FAILED - Drive mount missing or Chrome error >> "%LOG%"
  exit /b 1
)
echo %date% %time% OK >> "%LOG%"
endlocal
