@echo off
rem geminilm-drive: bake the memory/docs bundle into PDFs inside the Google Drive
rem folder, so Gemini LM's folder source picks up the new version automatically.
rem (Renamed 2026-08-22: Google renamed NotebookLM to Gemini LM. This file, the
rem  Node tools it calls, and the Task Scheduler entry all use the new name now -
rem  SYNK_GeminiLM. The synced Drive folder's name (Korean, still the old product
rem  name) was deliberately left as-is - see geminilm-drive.js's DEFAULT_OUT
rem  comment. That is a separate decision, not a leftover.)
rem Runs daily via Task Scheduler (SYNK_GeminiLM).
rem
rem WHY ASCII ONLY - INCLUDING COMMENTS: cmd.exe parses batch files in the OEM
rem codepage (CP949 here) while this file is saved as UTF-8. Korean bytes get
rem mangled and the damage is NOT contained by "rem" - the broken line cascades and
rem cmd starts executing fragments. Measured 2026-08-04: a single Korean word in a
rem comment made cmd try to run 'daily', 'WHY', 'an' as commands. This is why this
rem file keeps English file/task names even after the 2026-08-22 rename to Gemini LM.
rem The Drive mount is named in Korean, so DETECTION lives in the Node tool.
rem
rem WHY NO FALLBACK PATH: if Google Drive Desktop is off there is no mount, and the
rem Node tool exits(2) on purpose. Writing somewhere else would produce the worst
rem state - "looks uploaded, actually is not". The failure is logged instead.
setlocal
set REPO=C:\Users\q1212\Documents\SYNK-appsscript
set LOG=%REPO%\tools\geminilm-drive.log
cd /d "%REPO%"
if errorlevel 1 exit /b 1
node tools\geminilm-drive.js >> "%LOG%" 2>&1
if errorlevel 1 (
  echo %date% %time% FAILED - Drive mount missing or Chrome error >> "%LOG%"
  exit /b 1
)
echo %date% %time% OK >> "%LOG%"
endlocal
