@echo off
rem memory-push: sync local memory canon to synk-memory (cloud copy),
rem and pull down decision answers (_kyu/decision replies) committed by Actions.
rem Driven by the SYNK_MemoryPush trigger in Task Scheduler. THAT TRIGGER IS THE
rem CANON for the interval, so the interval is not restated here: this line read
rem "hourly" while the real trigger had long since become PT10M, and several
rem other docs repeated the same stale number (all fixed 2026-08-29).
rem To measure:  Get-ScheduledTask SYNK_MemoryPush ^| Get-ScheduledTaskInfo
rem If the PC is off, only this sync pauses - the cloud queue keeps running on
rem the last pushed copy.
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
rem WHY --autostash: ~19 sessions write into this memory dir continuously, so new
rem edits land in the worktree during the seconds between `add` and `pull` - and a
rem dirty worktree makes rebase REFUSE to start. That is the real cause of the 12
rem logged failures since 08-08 (verified 08-12: auth/network fine, no stuck
rem rebase, local was exactly 1 commit ahead - nothing to conflict over).
rem
rem WHY capture stderr: the old handler wrote only its own sentence, so git's
rem actual error never survived - "possible conflict" was a GUESS, and it was the
rem wrong one for 4 days. Failures must say which cause they were (CLAUDE.md).
set ERR=%TEMP%\synk-memsync.err
git add -A
git diff --cached --quiet || git commit -m "auto: memory sync"
git pull --rebase --autostash origin master 2> "%ERR%"
if errorlevel 1 (
  git rebase --abort 2>nul
  echo %date% %time% pull --rebase FAILED: >> "%LOG%"
  type "%ERR%" >> "%LOG%"
  exit /b 1
)
git push origin master 2> "%ERR%"
if errorlevel 1 (
  echo %date% %time% push FAILED: >> "%LOG%"
  type "%ERR%" >> "%LOG%"
  exit /b 1
)
endlocal
