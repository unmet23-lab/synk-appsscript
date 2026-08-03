@echo off
rem memory-push: sync local memory canon to synk-memory (cloud copy),
rem and pull down decision answers (_kyu/decision replies) committed by Actions.
rem Runs hourly via Task Scheduler (SYNK_MemoryPush). If the PC is off, only this
rem sync pauses - the cloud queue keeps running on the last pushed copy.
rem
rem WHY ASCII ONLY: cmd.exe parses batch files in the OEM codepage (CP949 here),
rem so Korean text in EXECUTABLE lines gets mangled and breaks parsing - the
rem 2026-08-04 v2 of this file failed exactly that way (cd silently failed and
rem git nearly ran in the wrong repo). Keep every line pure ASCII.
rem
rem WHY git add -A: this is the memory-only repo (not the shared worktree).
rem New memory files must always be swept in; git-scope-guard's premise
rem (multiple sessions sharing one tree) does not apply here.
rem
rem FAILURE HANDLING (coordinated with the Obsidian-track session 08-04):
rem two committers exist (local + cloud Actions). If rebase conflicts, the repo
rem would be stuck mid-rebase and every later run fails silently - so on failure
rem we abort the rebase (restore) and append to sync-fail.log, which rides along
rem in the next successful commit and becomes visible in the cloud too.
setlocal
set MEMDIR=C:\Users\q1212\.claude\projects\C--Users-q1212-Documents-SYNK-appsscript\memory
set LOG=%MEMDIR%\sync-fail.log
cd /d "%MEMDIR%"
if errorlevel 1 exit /b 1
git add -A
git diff --cached --quiet || git commit -m "auto: memory sync"
git pull --rebase origin master
if errorlevel 1 (
  git rebase --abort 2>nul
  echo %date% %time% pull --rebase FAILED - possible conflict, check manually >> "%LOG%"
  exit /b 1
)
git push origin master
if errorlevel 1 (
  echo %date% %time% push FAILED - check network or credentials >> "%LOG%"
  exit /b 1
)
endlocal
