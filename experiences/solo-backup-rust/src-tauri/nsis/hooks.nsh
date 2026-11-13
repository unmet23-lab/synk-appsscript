; SYNK 업무 백업 — what the machine-wide installer adds to Tauri's NSIS template
; (STAGE1_DESIGN.md 4.2 「컴퓨터 전체 설치」). The machine setup itself is WorkBackupRun.exe
; --install / --uninstall, run here with the installer's administrator token.
!include LogicLib.nsh

; A file the installer cannot write is never skipped: the question is retry or cancel, and a silent install
; stops (NSIS 3.13: with skipping allowed — the default — a silent install answers 「ignore」 and reports
; success over new and old files mixed, which the resource manifest then refuses at every run; Fable 5.2
; design review 1). The failure callback below then puts the executables back and takes the marker away.
AllowSkipFiles off

; While the marker is in the install folder (administrators-only writes), a run of the installed version
; ends at once, before it touches its lock, state or resources, and the window app does not start, so
; nothing starts and holds the files during an install or an uninstall (review GA3). Nothing after the
; marker asks or stops without first taking it away again (re-review c — NSIS calls the failure callbacks
; only when the failure window is closed); one left by a crash stops mattering after 30 minutes.
!macro SWB_MARK_INSTALLING
  ClearErrors
  FileOpen $0 "$INSTDIR\.installing" w
  ${IfNot} ${Errors}
    FileClose $0
  ${EndIf}
!macroend

; One pass of Restart Manager over the four images an installed version runs — the window app, the run
; executable, the worker (resources\node.exe) and restic — in one session, so there is one question at
; most. `ask` is 1 on the first pass only; an install is always passive and closes at once, an uninstall
; from Settings asks. A cancel, or a closing that fails (another user's session, no right to close it),
; takes the install's marker away itself and only then stops: so no failure window holds it, and an
; uninstall stops before anything changed (its marker comes after). If Restart Manager itself cannot be
; used this does nothing, as the template's own check does.
!macro SWB_CLOSE_PASS ask
  !insertmacro RestartManager_StartSession $R0
  ${If} $R0 != ""
    StrCpy $R4 0
    !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\${MAINBINARYNAME}.exe"
    IntOp $R4 $R4 | $0
    !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\WorkBackupRun.exe"
    IntOp $R4 $R4 | $0
    !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\resources\node.exe"
    IntOp $R4 $R4 | $0
    !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\resources\restic.exe"
    IntOp $R4 $R4 | $0
    ${If} $R4 = 0
      System::Call 'RSTRTMGR::RmGetList(p R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
      ${If} $0 = ${ERROR_MORE_DATA}
        !if "${ask}" == "1"
          ${IfNot} ${Silent}
          ${AndIf} $PassiveMode != 1
          ${AndIf} ${Cmd} `MessageBox MB_OKCANCEL "$R2" /SD IDOK IDCANCEL`
            !insertmacro RestartManager_EndSession $R0
            Delete "$INSTDIR\.installing"
            Abort "$R1"
          ${EndIf}
        !endif
        System::Call 'RSTRTMGR::RmShutdown(p R0, i ${RmForceShutdown}, p 0) i .r0'
        ${If} $0 <> 0
          !insertmacro RestartManager_EndSession $R0
          ; Restart Manager cannot close another session's processes — on a PC where people switch users, the
          ; window app left in someone else's tray. Say so, so the person knows what to do (Fable 5.2 review 4).
          IntOp $3 $3 & ${RmRebootReasonSessionMismatch}
          ${If} $3 <> 0
            StrCpy $R3 "다른 사용자가 이 컴퓨터에 로그인해 ${PRODUCTNAME}을 쓰고 있습니다. 그 사용자가 로그아웃한 뒤 다시 해 주세요."
          ${EndIf}
          Delete "$INSTDIR\.installing"
          Abort "$R3"
        ${EndIf}
      ${EndIf}
    ${EndIf}
    !insertmacro RestartManager_EndSession $R0
  ${EndIf}
!macroend

; Closes everything of the installed version: a first pass that may ask, then a second in a fresh session
; that does not, for what started while the question was open.
!macro SWB_CLOSE
  nsis_tauri_utils::StrReplace "$(appRunning)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R1
  nsis_tauri_utils::StrReplace "$(appRunningOkKill)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R2
  nsis_tauri_utils::StrReplace "$(failedToKillApp)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R3
  !insertmacro SWB_CLOSE_PASS 1
  !insertmacro SWB_CLOSE_PASS 0
!macroend

; The two executables are moved aside before the new ones are written, not overwritten: a run a trigger
; starts in between maps WorkBackupRun.exe for the moment it takes to see the marker, and a mapped image
; can be renamed but not overwritten (re-review GA3). A trigger that fires after the move finds no file and
; starts nothing. The old copies go once the install is done (at the next restart if one is still mapped);
; a failed install puts them back.
!macro SWB_SET_ASIDE name
  Delete "$INSTDIR\${name}.old"
  ClearErrors
  ${If} ${FileExists} "$INSTDIR\${name}"
    Rename "$INSTDIR\${name}" "$INSTDIR\${name}.old"
  ${EndIf}
!macroend
!macro SWB_PUT_BACK name
  ${IfNot} ${FileExists} "$INSTDIR\${name}"
  ${AndIf} ${FileExists} "$INSTDIR\${name}.old"
    Rename "$INSTDIR\${name}.old" "$INSTDIR\${name}"
  ${EndIf}
  ; The new one was written before the stop (the window app is the template's first file): the moved copy goes.
  Delete /REBOOTOK "$INSTDIR\${name}.old"
!macroend

; Install (always passive): marker, everything closed (never asks), then both executables moved aside
; before the template writes the new ones. The template's own check of the window app after this hook
; then finds nothing: its name is moved aside and the marker keeps it from starting.
!macro NSIS_HOOK_PREINSTALL
  !insertmacro SWB_MARK_INSTALLING
  !insertmacro SWB_CLOSE
  !insertmacro SWB_SET_ASIDE "WorkBackupRun.exe"
  !insertmacro SWB_SET_ASIDE "${MAINBINARYNAME}.exe"
!macroend

; The Task Scheduler folder every user adds their own scheduled runs to, owned by Administrators, with
; the permission to do so (4.2 「회차 작업」). If it cannot be made the app falls back to the root
; folder, so the install goes on; the result is in the install log.
!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"$INSTDIR\WorkBackupRun.exe" --install' $0
  ${If} $0 <> 0
    DetailPrint "SYNK: --install exit $0"
  ${EndIf}
  Delete /REBOOTOK "$INSTDIR\WorkBackupRun.exe.old"
  Delete /REBOOTOK "$INSTDIR\${MAINBINARYNAME}.exe.old"
  Delete "$INSTDIR\.installing"
!macroend

; What still stops an install after the hooks: a file the template cannot write (something outside SYNK holds
; it) and the person chooses to cancel, or a silent install, which cancels at once. NSIS calls this when the
; failure window is closed (a silent install: at once) — until then no run starts, since the executables are
; moved aside. Then the moved executables come back where their new ones are not there and runs may start
; again; files the template already wrote stay, so after a stopped update the version is mixed and needs an
; install again (the same version installed again runs as before). A function here is read before the
; template defines MAINBINARYNAME, so the window app's name is written out (tauri.conf.json mainBinaryName —
; the template test checks they agree).
Function .onInstFailed
  !insertmacro SWB_PUT_BACK "WorkBackupRun.exe"
  !insertmacro SWB_PUT_BACK "WorkBackup.exe"
  Delete "$INSTDIR\.installing"
FunctionEnd

; Uninstall: everything closed first — the one question there is, and a cancel or a failure stops before
; anything changed — then the marker, and nothing after it asks or stops. A scheduled run that started in
; between is a task instance, and --uninstall stops it as it deletes the tasks; the window app cannot
; start again while the marker is there, so the template's own check after this hook finds nothing. For a
; real uninstall (not an in-place update), every user's scheduled runs of this installation and their
; folder go, so nothing starts the removed files again. User state and cloud backups stay
; (4.2 「컴퓨터 전체 설치」 지우기). If the window app is opened in the moment between the closing and the
; marker, the template's own check closes it without asking (the person agreed once already — Fable 5.2
; review 5); the setting is put back before the template decides whether the window closes by itself.
Var SwbPassiveMode
!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro SWB_CLOSE
  !insertmacro SWB_MARK_INSTALLING
  StrCpy $SwbPassiveMode $PassiveMode
  StrCpy $PassiveMode 1
  ${If} $UpdateMode <> 1
    ExecWait '"$INSTDIR\WorkBackupRun.exe" --uninstall' $0
    ${If} $0 <> 0
      DetailPrint "SYNK: --uninstall exit $0"
    ${EndIf}
  ${EndIf}
!macroend

; Nothing after the marker in an uninstall stops it; this only covers a failure there all the same.
Function un.onUninstFailed
  Delete "$INSTDIR\.installing"
FunctionEnd

; The marker, old executables an install left for the next restart, the folder they kept, and the install
; location Tauri records (our install folder is fixed, so nothing reads it) go too.
!macro NSIS_HOOK_POSTUNINSTALL
  StrCpy $PassiveMode $SwbPassiveMode
  Delete "$INSTDIR\.installing"
  Delete /REBOOTOK "$INSTDIR\WorkBackupRun.exe.old"
  Delete /REBOOTOK "$INSTDIR\${MAINBINARYNAME}.exe.old"
  RMDir "$INSTDIR"
  ${If} $UpdateMode <> 1
    DeleteRegKey HKLM "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty HKLM "${MANUKEY}"
  ${EndIf}
!macroend
